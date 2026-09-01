# Fulgencio Project

## Conversación del agente de voz

Cuando `VOICE_AGENT_TYPE=fulgencio_agent`, este proyecto puede definir su conversación en
`back/prompts.py` mediante:

```python
FULGENCIO_CONVERSATION_INSTRUCTIONS = """
Describe aquí la personalidad, el saludo inicial, los temas permitidos,
el recorrido de la conversación y el estilo de charla durante las esperas.
""".strip()
```

El texto puede definir tono, idioma, límites temáticos, forma de presentar las opciones y temas de
conversación. No debe definir nombres de herramientas, esquemas de argumentos, llamadas a APIs,
consultas SQL, escrituras en Firebase ni transiciones internas. Esas responsabilidades pertenecen a
`fulgencio-agent`.

Si `prompts.py` no existe, la constante no existe, vale `None` o queda vacía, el backend no envía
configuración y `fulgencio-agent` usa su comportamiento predeterminado.

El backend carga el archivo al arrancar. Después de modificarlo, reinicia el backend en desarrollo o
reconstruye y redespliega su contenedor.

## Plantilla para otros proyectos

Para integrar un backend nuevo:

1. Configura `FULGENCIO_AGENT_URL` y selecciona `VOICE_AGENT_TYPE=fulgencio_agent`.
2. Crea un `prompts.py` junto al entrypoint Python con la constante anterior.
3. Al abrir el WebSocket remoto, añade `conversation_config=1` y envía primero:

```json
{
  "type": "conversation.configure",
  "instructions": "..."
}
```

4. Empieza a reenviar audio únicamente después de ese frame.

Un prompt solo adapta la conversación; no crea capacidades que el agente no tenga implementadas.
