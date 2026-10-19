# Gran Sorteo Institucional - INEI
### Sistema de sorteos con tómbola virtual

Aplicación de escritorio con la identidad visual del **Instituto Nacional de Estadística e Informática (INEI)**: azul marino y azul del logo institucional.

© 2026 Alexander Loo - INEI. Todos los derechos reservados.

---

## Instalación para usuarios (sin código)

1. Descarga **`Instalador-Sorteo-INEI-x.y.z.exe`** desde la sección **Releases** del repositorio.
2. Ejecútalo y sigue el asistente. Se crea un acceso directo en el escritorio.
3. Abre **Gran Sorteo INEI**. No requiere instalar nada más.

## Generar el instalador (para quien mantiene el proyecto)

- **En la nube (sin instalar nada):** en GitHub, pestaña *Actions* > *Construir instalador* > *Run workflow*. El `.exe` queda como artefacto. Si se sube un tag `v1.0.0`, se publica además en *Releases*.
- **En local:** con Node.js instalado, ejecuta `CONSTRUIR_INSTALADOR.bat`. El instalador queda en la carpeta `dist`.

## Uso en desarrollo

- `npm install` y luego `npm start` (modo escritorio), o `INICIAR_SORTEO_DIRECTO.bat` (abre `index.html` en Edge/Chrome).

---

## ✨ Características Principales

1. **Copia y Pega Directo desde Excel**:
   - Pulsa el botón **"📋 Cargar Participantes"**.
   - Selecciona en Excel tus 2 columnas:
     - **Columna 1**: Número de ticket (ej. `T-1001` o `125`)
     - **Columna 2**: Nombre de la persona (ej. `Lic. Carlos Mendoza Quispe`)
   - Pégalas con `Ctrl + V` en el cuadro de texto y pulsa **"💾 Procesar y Guardar"**.
   - *Inteligencia automática*: Omite encabezados de fila (ej. "Ticket", "Nombre"), detecta y descarta tickets duplicados para evitar inconsistencias, y muestra una tabla con vista previa instantánea.
   - También permite subir archivos `.xlsx` o `.csv` directamente, o pulsar **"⚡ Cargar Demostración INEI"** para probar de inmediato con 60 participantes realistas.

2. **Tómbola Virtual 3D y Mezclado en Vivo**:
   - Esfera de cristal translúcida modelada en **HTML5 Canvas** con iluminación, sombras y física de rebote elástico.
   - Decenas de bolas con los números de tickets en colores institucionales (Azul INEI, Cian, Blanco, Oro y Rojo Perú) que giran y se mezclan a gran velocidad con turbulencia y fuerza centrífuga al pulsar **"¡INICIAR SORTEO!"**.

3. **Visor Digital de Sorteo con Tensión Gradual**:
   - Un gran display digital que alterna los tickets y nombres a alta velocidad durante el sorteo.
   - Curva de desaceleración progresiva que genera suspenso y expectativa en el público antes de fijar al ganador.
   - Efectos sonoros mecánicos (*ticks* de ruleta, redoble de tambor) generados en tiempo real mediante la **Web Audio API** (100% autónomo, funciona sin internet ni archivos externos).

4. **Regla de los 3 Sorteos con Exclusión Automática**:
   - La aplicación gestiona **3 Sorteos** (Sorteo 1, Sorteo 2 y Sorteo 3).
   - **Exclusión total**: El ganador del primer sorteo queda automáticamente excluido del segundo y tercer sorteo. Si gana el segundo, ya no participa en el tercero. Ninguna persona puede repetir premio.
   - Contadores en tiempo real en la cabecera:
     - **Participantes**: Total de registros cargados.
     - **Habilitados**: Participantes disponibles para el sorteo actual (se descuentan automáticamente los que ya ganaron).
     - **Ganadores**: Número de ganadores proclamados (0 a 3).
   - Nombres de premios personalizables para cada uno de los 3 sorteos.

5. **Celebración en Vivo y Diploma Oficial**:
   - Al finalizar cada sorteo, la pantalla se transforma con una gran celebración:
     - Lluvia de confeti y cintas doradas con física de gravedad.
     - Cohetes de fuegos artificiales explotando en el fondo.
     - Fanfarria triunfal y aplausos de estadio sintetizados.
     - Proclamación gigante con el número de ticket premiado y el nombre del ganador.
   - **Descarga de Diploma Oficial (PNG)**: Botón con 1 clic para generar y descargar un diploma oficial institucional con membrete del INEI, fecha, sellos y firmas, listo para imprimir o proyectar.

6. **Podio de Ganadores y Exportación**:
   - 3 tarjetas en la parte inferior para consultar el estado de cada sorteo.
   - Permite volver a descargar el diploma de cualquier ganador en cualquier momento.
   - Permite anular o repetir un sorteo individualmente si la persona no se encontraba presente.
   - Botón **"📥 Exportar"** para generar una planilla CSV/Excel con el acta oficial de los 3 ganadores y la lista completa de tickets.
   - Persistencia automática en `localStorage`: no se pierde ningún dato si se cierra la aplicación por accidente.
