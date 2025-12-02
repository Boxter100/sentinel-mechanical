// src/pages/api/checkout.js
import Stripe from 'stripe';

export async function POST({ request }) {
  try {
    // Inicializar Stripe dentro de la función
    const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia',
    });

    // Validar que existe la API key
    if (!import.meta.env.STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Configuración de Stripe no encontrada' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Obtener los items del carrito desde el body de la petición
    const { items } = await request.json();

    // Validar que haya items
    if (!items || Object.keys(items).length === 0) {
      return new Response(
        JSON.stringify({ error: 'El carrito está vacío' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Determinar una base URL HTTPS para imágenes y callbacks
    const reqOrigin = request.headers.get('origin');
    const urlOrigin = new URL(request.url).origin;
    const envOrigin = import.meta.env.PUBLIC_SITE_URL;
    const baseUrl = [envOrigin, reqOrigin, urlOrigin, 'https://mechanical.sentinellab.tech']
      .find(u => typeof u === 'string' && u.startsWith('https://')) || 'https://mechanical.sentinellab.tech';

    // Helper para generar URLs absolutas a partir de rutas relativas
    const toAbsoluteUrl = (maybeRelative) => {
      if (!maybeRelative) return undefined;
      if (typeof maybeRelative !== 'string') return undefined;
      if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative; // ya es absoluta
      const path = maybeRelative.startsWith('/') ? maybeRelative : `/${maybeRelative}`;
      return `${baseUrl}${path}`;
    };

    // Convertir los items del carrito al formato que Stripe necesita
    const lineItems = Object.values(items).map(item => ({
      price_data: {
        currency: 'mxn',
        product_data: {
          name: item.name,
          images: item.image ? [toAbsoluteUrl(item.image)].filter(Boolean) : [],
          description: item.description || `Producto: ${item.name}`,
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: Number(item.quantity) || 1,
    }));

    // Crear la sesión de Checkout en Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Métodos de pago aceptados
      line_items: lineItems,
      mode: 'payment', // 'payment' para pagos únicos
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/failure`,
      
      // Configuración adicional
      billing_address_collection: 'auto',
      shipping_address_collection: {
        allowed_countries: ['MX'], // Solo México
      },
      
      // Metadata para tracking interno
      metadata: {
        timestamp: new Date().toISOString(),
        total_items: Object.keys(items).length,
      },
      
      // Configuración de idioma
      locale: 'es',
    });

    // Devolver la URL de checkout al frontend
    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error al crear la sesión de Stripe:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Error al procesar el pago',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Prevenir que se pre-renderice durante el build
export const prerender = false;
