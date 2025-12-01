// src/pages/api/checkout.js
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

export async function POST({ request }) {
  try {
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

    // Convertir los items del carrito al formato que Stripe necesita
    const lineItems = Object.values(items).map(item => ({
      price_data: {
        currency: 'mxn', // Moneda en pesos mexicanos
        product_data: {
          name: item.name,
          images: [item.image], // Stripe acepta URLs de imágenes
          description: item.description || `Producto: ${item.name}`,
        },
        unit_amount: Math.round(item.price * 100), // Stripe maneja centavos, por eso multiplicamos por 100
      },
      quantity: item.quantity,
    }));

    // Obtener el origin del request para las URLs de redirección
    const origin = request.headers.get('origin') || 'https://mechanical.sentinellab.tech/';

    // Crear la sesión de Checkout en Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], // Métodos de pago aceptados
      line_items: lineItems,
      mode: 'payment', // 'payment' para pagos únicos, 'subscription' para suscripciones
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`, // URL de éxito
      cancel_url: `${origin}/canceled`, // URL de cancelación
      
      // Configuración adicional (opcional)
      billing_address_collection: 'auto', // Recolectar dirección de facturación
      shipping_address_collection: {
        allowed_countries: ['MX'], // Solo México
      },
      
      // Metadata para tracking interno (opcional pero recomendado)
      metadata: {
        timestamp: new Date().toISOString(),
        total_items: Object.keys(items).length,
      },
      
      // Configuración de idioma
      locale: 'es', // Interfaz en español
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