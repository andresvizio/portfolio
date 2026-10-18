# andresvizio.com

Portfolio personal de Andy Vizio. Sitio estático: HTML, CSS y JS planos, sin
build ni dependencias que instalar. Se abre `index.html` y funciona.

## Estructura

```
index.html      estructura y contenido
styles.css      todos los estilos
script.js       fade-in al scroll, parallax del hero, header sticky
shader.js       shader WebGPU del hero y el footer (ver abajo)
assets/         imágenes, logo, favicon + ASSETS.md con el origen de cada una
CNAME           dominio propio, lo lee GitHub Pages
.nojekyll       evita que GitHub procese el sitio con Jekyll
```

## Deploy

GitHub Pages publica automáticamente cada push a `main`. No hay paso de build.

Para ver los cambios antes de publicar, basta abrir `index.html` en el navegador:
al no haber build, lo que ves local es exactamente lo que se publica.

## El shader

El hero y el footer llevan el shader WebGPU exportado desde Figma. El WGSL y las
funciones `setup` / `render` son los del módulo original; lo único propio es el
host que los maneja desde un `<canvas>`, porque Figma entrega un componente React
y este sitio es HTML plano.

Requiere WebGPU (Chrome y Edge 113+, Safari 18+). Si el navegador no lo soporta
o la GPU falla, el canvas se oculta solo y queda el fondo blanco: no se rompe
nada.

Los parámetros de rendimiento están en el objeto `CONFIG`, arriba de `shader.js`:

| Parámetro | Valor | Qué hace |
|---|---|---|
| `maxDpr` | 1 | Resolución de render. Subir a 1.5 da más nitidez y cuesta el doble |
| `sampleCount` | 1 | Antialiasing. 4 es como lo exporta Figma |
| `sphereResolution` | 64 | Densidad de la malla (Figma usa 112) |
| `maxFps` | 30 | La animación es muy lenta, 60 no se distingue |

## Assets

Todas las imágenes son locales, en `assets/`. `assets/ASSETS.md` documenta de
dónde salió cada una y con qué medidas.

Importante: **nunca usar las URLs de assets que devuelve el MCP de Figma como
fuente en producción** — caducan a los 7 días. Hay que exportar y guardar local.

## Pendientes

- Los dos links "Full landing page" (Jukebox y Xapo's Vault) apuntan a `#`.
- El GIF de Onboarding pesa 3,4 MB. Convertido a MP4/WebM bajaría a ~300 KB.
