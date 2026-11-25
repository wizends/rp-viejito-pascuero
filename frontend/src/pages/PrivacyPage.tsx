export default function PrivacyPage() {
  return (
    <article className="papel-crema mx-auto mt-6 max-w-3xl rounded-galleta p-6 text-tinta shadow-papel sm:p-10">
      <h1 className="font-cuento text-4xl text-rojo-baya">Cómo cuidamos las cartas</h1>
      <p className="mt-3 font-semibold text-tinta-suave">
        Las cartas son de niños y niñas, así que las tratamos como el tesoro más grande del Polo Norte.
      </p>
      <div className="mt-6 space-y-5 leading-relaxed">
        <section>
          <h2 className="text-xl">¿Quién puede ver una carta?</h2>
          <p>
            Solo la cuenta del papá, mamá o tutor que la envió. Nadie más del sitio puede verlas. La vista de
            seguimiento del niño muestra solo su apodo, su avatar y las paradas del regalo.
          </p>
        </section>
        <section>
          <h2 className="text-xl">¿Qué datos pedimos?</h2>
          <p>
            Un apodo y, si quieres, la edad aproximada. No pedimos apellidos, direcciones ni colegio. Si una carta
            trae teléfonos, RUT, direcciones o colegios, los tapamos automáticamente al leerla.
          </p>
        </section>
        <section>
          <h2 className="text-xl">¿Qué pasa con las fotos?</h2>
          <p>
            Al subirlas las volvemos a dibujar desde cero: así se borran los datos ocultos de la cámara, incluida la
            ubicación GPS. Cuando la carta se lee bien, la foto se borra. Si necesita ayuda de un duende, la
            guardamos para que la transcribas tú, y se borra apenas lo hagas o, como máximo, a los 60 días.
          </p>
        </section>
        <section>
          <h2 className="text-xl">¿Quién lee la letra manuscrita?</h2>
          <p>
            Por defecto, todo se procesa en nuestro propio servidor con modelos gratuitos (OCR y TrOCR). Solo si tú
            lo activas en tu panel, una IA externa con capa gratuita puede ayudar con letras difíciles.
          </p>
        </section>
        <section>
          <h2 className="text-xl">¿Puedo borrar todo?</h2>
          <p>Sí. Desde el panel puedes borrar cada carta o el perfil completo de un niño, con todas sus cartas.</p>
        </section>
      </div>
    </article>
  );
}
