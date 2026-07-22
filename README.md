# TruckMap México

Aplicación web móvil para planear y seguir rutas compatibles con vehículos pesados. La primera cobertura es una beta para Guanajuato, con énfasis en el corredor León-Silao-Irapuato-Salamanca-Celaya.

La aplicación no garantiza autorización legal de tránsito. Combina las restricciones disponibles en TomTom con un catálogo local versionado y siempre debe ceder ante la señalización y la autoridad vial.

## Funcionalidad

- Planificador con búsqueda de lugares en México.
- Perfiles para rabón, torton, tractocamión y doble remolque.
- Peso, peso por eje, número de ejes, altura, ancho, longitud y carga peligrosa.
- Alternativas con distancia, tiempo, tráfico y detección de peaje.
- Validación contra restricciones locales aprobadas.
- Navegación GPS en primer plano, Wake Lock, voz y recálculo por desvío.
- Enlaces compartibles de origen y destino.
- Formulario de reportes georreferenciados enviado por correo.
- PWA instalable en Android y iPhone.

## Requisitos

- Node.js 22 o posterior.
- Cuenta gratuita de TomTom.
- Cuenta de Resend y dominio verificado para recibir sugerencias.
- Vercel para el despliegue recomendado.

## Configuración

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configura como mínimo `TOMTOM_API_KEY` y `NEXT_PUBLIC_TOMTOM_API_KEY`. Sin estas claves el mapa utiliza un fondo CARTO de demostración y la búsqueda muestra los principales municipios de Guanajuato, pero el cálculo de rutas queda bloqueado para evitar resultados inseguros.

Para sugerencias configura `RESEND_API_KEY`, `SUGGESTIONS_FROM_EMAIL` y `SUGGESTIONS_TO_EMAIL`. Turnstile y Upstash son opcionales localmente y recomendados en producción.

## Comandos

```bash
npm run lint
npm test
npm run build
npm start
```

## Despliegue

1. Importa el repositorio en Vercel.
2. Registra las variables de `.env.example` para producción y previews.
3. Restringe la clave pública de TomTom a los dominios de Vercel y al dominio final.
4. Configura alertas de cuota en TomTom.
5. Habilita Upstash para que los límites funcionen entre todas las funciones serverless.
6. Verifica la recepción de correo antes de publicar el botón de sugerencias.

La PWA necesita HTTPS para GPS, Wake Lock y service worker. Vercel proporciona HTTPS automáticamente.

## Datos

Fuentes de referencia:

- [Red Nacional de Caminos, INEGI](https://www.inegi.org.mx/programas/rnc/)
- [Red Vial del Estado de Guanajuato, IPLANEG](https://geoinfo.iplaneg.net/layers/geonode:red_vial_gto)
- NOM-012-SCT-2-2017 y reclasificaciones publicadas en el DOF
- Reglamentos y gacetas municipales

El procedimiento para incorporar restricciones está documentado en [`src/data/README.md`](src/data/README.md). El catálogo inicia vacío porque no se deben presentar reglas de demostración como restricciones oficiales.

## Limitaciones

- Requiere internet y la PWA abierta para navegación.
- No ofrece navegación con pantalla bloqueada ni mapas sin conexión.
- No incluye cuentas, historial, rastreo de flotas o panel administrativo.
- Las cuotas gratuitas limitan el número de búsquedas, rutas, mosaicos y recálculos.
- La cobertura legal municipal depende de recopilar y verificar publicaciones oficiales.
- El service worker no guarda mosaicos de mapas de terceros.

## Privacidad

La posición GPS permanece en el navegador, salvo cuando se envía para calcular una ruta o se adjunta voluntariamente a un reporte. Los perfiles se guardan en `localStorage`. No se almacena historial de rutas ni se exige registro.
