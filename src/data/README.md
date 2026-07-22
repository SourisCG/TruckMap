# Restricciones viales

`restrictions.ts` contiene únicamente restricciones que pueden afectar una ruta. Un registro solo participa en la validación cuando su estado es `approved` y se encuentra vigente.

## Proceso de aprobación

1. Recibir el reporte en el buzón configurado.
2. Confirmar ubicación, sentido de circulación, vehículos afectados y vigencia.
3. Obtener una publicación de SICT, DOF, gobierno estatal o gobierno municipal.
4. Convertir el tramo afectado a coordenadas WGS84.
5. Agregar el registro inicialmente como `draft`.
6. Revisar fuente, geometría y límites con una segunda persona.
7. Cambiar el estado a `approved`, actualizar `RESTRICTIONS_VERSION` y desplegar.

No deben aprobarse publicaciones de redes sociales, mensajes privados o testimonios sin confirmación oficial. Los cierres temporales deben incluir `validUntil`.

## Unidades

- `max_weight`: toneladas métricas.
- `max_height`: metros.
- `max_length`: metros.
- Coordenadas: latitud y longitud WGS84.
