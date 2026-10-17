/* =============================================================================
   Figma shader fill — ported verbatim from the "Portfolio 2024" frame
   (file edJ5Y8FH2vxElAcVEJybaO, node 1517:3646).

   The WGSL module and the setup()/render() pair below are the shader exactly as
   authored in Figma. Only the host is ours: Figma ships a React <ShaderFill>
   component, and this site is plain HTML, so the wrapper underneath drives the
   same functions from a <canvas data-shader> element.

   Requires WebGPU (Chrome/Edge 113+, Safari 18+). Without it nothing is drawn
   and the solid background behind the canvas shows through.
   ========================================================================== */

(function () {
  'use strict';

  var SHADER_WGSL = `
struct Uniforms {
  detail: f32,
  time: f32,
  aspectRatio: f32,
  gradientStopCount: f32,
  colors: array<vec4f, 8>,
  stops: array<vec4f, 2>,
  zoom: f32,
  morphSpeed: f32,
  material: f32,
  rotationSpeed: f32,
  gradientBalance: f32,
  shading: f32,
  warp: f32,
  intensity: f32,
  twist: f32,
  gradientMethod: f32,
  pad0: f32,
  pad1: f32,
}

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsIn {
  @location(0) position: vec3f,
}

struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) baseDirection: vec3f,
  @location(1) worldPosition: vec3f,
}

struct BackdropOut {
  @builtin(position) position: vec4f,
  @location(0) screenUv: vec2f,
}

fn hash33(p: vec3f) -> vec3f {
  let q = vec3f(
    dot(p, vec3f(127.1, 311.7, 74.7)),
    dot(p, vec3f(269.5, 183.3, 246.1)),
    dot(p, vec3f(113.5, 271.9, 124.6))
  );
  return fract(sin(q) * 43758.5453) * 2.0 - 1.0;
}

fn smootherCurve(t: vec3f) -> vec3f {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

fn gradDot(cell: vec3f, offset: vec3f, local: vec3f) -> f32 {
  return dot(hash33(cell + offset), local - offset);
}

fn perlin3(p: vec3f) -> f32 {
  let cell = floor(p);
  let local = fract(p);
  let w = smootherCurve(local);

  let n000 = gradDot(cell, vec3f(0.0, 0.0, 0.0), local);
  let n100 = gradDot(cell, vec3f(1.0, 0.0, 0.0), local);
  let n010 = gradDot(cell, vec3f(0.0, 1.0, 0.0), local);
  let n110 = gradDot(cell, vec3f(1.0, 1.0, 0.0), local);
  let n001 = gradDot(cell, vec3f(0.0, 0.0, 1.0), local);
  let n101 = gradDot(cell, vec3f(1.0, 0.0, 1.0), local);
  let n011 = gradDot(cell, vec3f(0.0, 1.0, 1.0), local);
  let n111 = gradDot(cell, vec3f(1.0, 1.0, 1.0), local);

  let nx00 = mix(n000, n100, w.x);
  let nx10 = mix(n010, n110, w.x);
  let nx01 = mix(n001, n101, w.x);
  let nx11 = mix(n011, n111, w.x);
  let nxy0 = mix(nx00, nx10, w.y);
  let nxy1 = mix(nx01, nx11, w.y);

  return mix(nxy0, nxy1, w.z) * 1.1547;
}

fn rotateOctave(p: vec3f) -> vec3f {
  return vec3f(
     0.00 * p.x + 0.80 * p.y + 0.60 * p.z,
    -0.80 * p.x + 0.36 * p.y - 0.48 * p.z,
    -0.60 * p.x - 0.48 * p.y + 0.64 * p.z
  );
}

fn fbm(p: vec3f) -> f32 {
  var q = p;
  var total = 0.0;
  var amplitude = 1.0;
  var weight = 0.0;

  for (var i = 0; i < 3; i = i + 1) {
    total = total + perlin3(q) * amplitude;
    weight = weight + amplitude;
    q = rotateOctave(q) * 2.02 + vec3f(3.7, 1.9, 6.3);
    amplitude = amplitude * 0.48;
  }

  return total / max(weight, 0.0001);
}

fn warpVector(p: vec3f) -> vec3f {
  return vec3f(
    perlin3(p),
    perlin3(p + vec3f(5.2, 1.3, 2.8)),
    perlin3(p + vec3f(1.7, 9.2, 4.4))
  );
}

fn wrapPhase(phase: f32) -> f32 {
  let tau = 6.28318530718;
  return phase - floor(phase / tau) * tau;
}

fn curvedDomainMotion(
  morphTime: f32,
  rates: vec3f,
  phases: vec3f
) -> vec3f {
  return vec3f(
    sin(wrapPhase(morphTime * rates.x + phases.x)),
    sin(wrapPhase(morphTime * rates.y + phases.y)),
    cos(wrapPhase(morphTime * rates.z + phases.z))
  );
}

fn primaryDomainMotion(morphTime: f32) -> vec3f {
  let primaryDirection = normalize(vec3f(0.73, -0.41, 0.55));
  let secondaryDirection = normalize(vec3f(-0.28, 0.91, 0.31));
  let primaryDrift = primaryDirection * morphTime * 0.105;
  let secondaryDrift = secondaryDirection * morphTime * 0.023;
  let curve = curvedDomainMotion(
    morphTime,
    vec3f(0.071, 0.043, 0.029),
    vec3f(0.0, 1.73, 4.11)
  ) * 0.16;
  return primaryDrift + secondaryDrift + curve;
}

fn warpDomainMotion(morphTime: f32) -> vec3f {
  let primaryDirection = normalize(vec3f(-0.46, 0.38, 0.80));
  let secondaryDirection = normalize(vec3f(0.84, 0.51, -0.18));
  let primaryDrift = primaryDirection * morphTime * 0.137;
  let secondaryDrift = secondaryDirection * morphTime * 0.031;
  let curve = curvedDomainMotion(
    morphTime,
    vec3f(0.089, 0.053, 0.034),
    vec3f(2.21, 5.07, 0.83)
  ) * 0.12;
  return primaryDrift + secondaryDrift + curve;
}

fn gradientDomainMotion(morphTime: f32) -> vec3f {
  let primaryDirection = normalize(vec3f(0.32, 0.76, -0.57));
  let secondaryDirection = normalize(vec3f(-0.88, 0.17, -0.44));
  let primaryDrift = primaryDirection * morphTime * 0.079;
  let secondaryDrift = secondaryDirection * morphTime * 0.019;
  let curve = curvedDomainMotion(
    morphTime,
    vec3f(0.061, 0.037, 0.023),
    vec3f(4.37, 0.91, 2.68)
  ) * 0.19;
  return primaryDrift + secondaryDrift + curve;
}

fn heightField(direction: vec3f, detail: f32) -> f32 {
  let detailLevel = clamp(detail / 5.0, 0.0, 1.0);
  let frequency = mix(1.05, 3.4, detailLevel);
  let morphTime = u.time * max(u.morphSpeed, 0.0);
  let primaryMotion = primaryDomainMotion(morphTime);
  let warpMotion = warpDomainMotion(morphTime);
  let p = direction * frequency +
    vec3f(1.7, 3.1, 5.3) +
    primaryMotion;
  let warp = warpVector(
    p * 0.55 +
    warpMotion * 0.42 +
    vec3f(0.7, -1.1, 0.4)
  ) * u.warp;
  return fbm(p + warp);
}

fn displacementAmount(detail: f32) -> f32 {
  let amount = clamp(detail, 0.0, 1.0);
  let easedAmount = amount * amount * (3.0 - 2.0 * amount);
  return easedAmount * 0.30 * clamp(u.intensity, 0.0, 5.0);
}

fn surfacePoint(direction: vec3f, detail: f32) -> vec3f {
  let height = heightField(direction, detail);
  let displacedRadius = 1.0 + height * displacementAmount(detail);
  let safeRadius = max(displacedRadius, 0.72);
  return direction * safeRadius;
}

fn rotateAroundAxis(p: vec3f, axis: vec3f, angle: f32) -> vec3f {
  let c = cos(angle);
  let s = sin(angle);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

fn twistAxis() -> vec3f {
  return normalize(vec3f(-0.68, 0.54, 0.49));
}

fn torsionAngle(direction: vec3f) -> f32 {
  let axis = twistAxis();
  let axial = clamp(dot(direction, axis), -1.0, 1.0);
  let smoothAxial = axial * (1.5 - 0.5 * axial * axial);
  return smoothAxial * clamp(u.twist, 0.0, 7.0);
}

fn twistedSurfacePoint(direction: vec3f, detail: f32) -> vec3f {
  let axis = twistAxis();
  let point = surfacePoint(direction, detail);
  return rotateAroundAxis(point, axis, torsionAngle(direction));
}

fn twistedFieldNormal(direction: vec3f, detail: f32) -> vec3f {
  var reference = vec3f(0.0, 1.0, 0.0);
  if (abs(direction.y) > 0.9) {
    reference = vec3f(1.0, 0.0, 0.0);
  }

  let tangent = normalize(cross(reference, direction));
  let bitangent = normalize(cross(direction, tangent));
  let epsilon = 0.02;

  let tA = twistedSurfacePoint(
    normalize(direction - tangent * epsilon),
    detail
  );
  let tB = twistedSurfacePoint(
    normalize(direction + tangent * epsilon),
    detail
  );
  let bA = twistedSurfacePoint(
    normalize(direction - bitangent * epsilon),
    detail
  );
  let bB = twistedSurfacePoint(
    normalize(direction + bitangent * epsilon),
    detail
  );

  var normal = normalize(cross(tB - tA, bB - bA));
  let outward = normalize(twistedSurfacePoint(direction, detail));
  if (dot(normal, outward) < 0.0) {
    normal = -normal;
  }
  return normal;
}

fn spreadCoordinate(raw: f32) -> f32 {
  let gain = 3.0;
  return clamp((raw - 0.5) * gain + 0.5, 0.0, 1.0);
}

fn objectGradientCoordinate(
  method: i32,
  direction: vec3f,
  field: f32,
  morphTime: f32
) -> f32 {
  if (method == 1) {
    let gradientMotion = gradientDomainMotion(morphTime);
    let gradientWarpMotion = warpDomainMotion(morphTime * 0.71);
    let p = direction * 1.18 +
      vec3f(-2.4, 4.1, 1.6) +
      gradientMotion;
    let broadWarp = warpVector(
      p * 0.42 +
      vec3f(3.2, -1.7, 2.5) +
      gradientWarpMotion * 0.19
    ) * 0.16;
    return spreadCoordinate(fbm(p + broadWarp) * 0.5 + 0.5);
  }

  return spreadCoordinate(field * 0.5 + 0.5);
}

fn srgbToLinear(c: vec3f) -> vec3f {
  let v = max(c, vec3f(0.0));
  let cutoff = step(vec3f(0.04045), v);
  let low = v / 12.92;
  let high = pow((v + 0.055) / 1.055, vec3f(2.4));
  return mix(low, high, cutoff);
}

fn linearToSrgb(c: vec3f) -> vec3f {
  let v = max(c, vec3f(0.0));
  let cutoff = step(vec3f(0.0031308), v);
  let low = v * 12.92;
  let high = 1.055 * pow(v, vec3f(1.0 / 2.4)) - 0.055;
  return mix(low, high, cutoff);
}

fn linearToOklab(c: vec3f) -> vec3f {
  let l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  let m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  let s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;

  let lc = pow(max(l, 0.0), 1.0 / 3.0);
  let mc = pow(max(m, 0.0), 1.0 / 3.0);
  let sc = pow(max(s, 0.0), 1.0 / 3.0);

  return vec3f(
    0.2104542553 * lc + 0.7936177850 * mc - 0.0040720468 * sc,
    1.9779984951 * lc - 2.4285922050 * mc + 0.4505937099 * sc,
    0.0259040371 * lc + 0.7827717662 * mc - 0.8086757660 * sc
  );
}

fn oklabToLinear(c: vec3f) -> vec3f {
  let lc = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  let mc = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  let sc = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;

  let l = lc * lc * lc;
  let m = mc * mc * mc;
  let s = sc * sc * sc;

  return vec3f(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

fn stopPosition(index: i32) -> f32 {
  if (index < 4) {
    return u.stops[0][index];
  }
  return u.stops[1][index - 4];
}

fn gradientAt(t: f32) -> vec4f {
  let count = clamp(i32(u.gradientStopCount + 0.5), 1, 8);
  if (count == 1) {
    return u.colors[0];
  }

  var lowIndex = 0;
  for (var i = 0; i < 7; i = i + 1) {
    if (i >= count - 1) {
      break;
    }
    if (t >= stopPosition(i)) {
      lowIndex = i;
    }
  }
  let highIndex = lowIndex + 1;

  let start = stopPosition(lowIndex);
  let end = stopPosition(highIndex);
  var amount = clamp((t - start) / max(end - start, 0.0001), 0.0, 1.0);
  amount = amount * amount * (3.0 - 2.0 * amount);

  let a = u.colors[lowIndex];
  let b = u.colors[highIndex];

  let labA = linearToOklab(srgbToLinear(a.rgb));
  let labB = linearToOklab(srgbToLinear(b.rgb));
  let blended = linearToSrgb(oklabToLinear(mix(labA, labB, amount)));

  return vec4f(blended, mix(a.a, b.a, amount));
}

fn balanceRemap(coordinate: f32) -> f32 {
  let balance = clamp(u.gradientBalance, -1.0, 1.0);
  let balanceExponent = pow(4.0, balance);
  return pow(clamp(coordinate, 0.0, 1.0), 1.0 / balanceExponent);
}

fn rotateX(p: vec3f, angle: f32) -> vec3f {
  let c = cos(angle);
  let s = sin(angle);
  return vec3f(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

fn animatedOrientation(p: vec3f, rotationTime: f32) -> vec3f {
  let axisA = normalize(vec3f(0.36, 0.81, 0.46));
  let axisB = normalize(vec3f(-0.71, 0.29, 0.64));
  let axisC = normalize(vec3f(0.58, -0.69, 0.43));

  let angleA = wrapPhase(rotationTime * 0.287);
  let angleB = wrapPhase(rotationTime * 0.2236068);
  let angleC = wrapPhase(rotationTime * 0.1732051);

  var oriented = rotateAroundAxis(p, axisA, angleA);
  oriented = rotateAroundAxis(oriented, axisB, angleB);
  oriented = rotateAroundAxis(oriented, axisC, angleC);
  return rotateX(oriented, -0.24);
}

fn coverSphereScale(aspect: f32) -> f32 {
  let safeRadius = 0.72;
  let cameraDistance = 3.0;
  let targetZoom = 4.0;
  let baseFocalLength = 1.73;
  let diagonal = sqrt(1.0 + aspect * aspect);
  let targetFocalLength = baseFocalLength * targetZoom;
  let requiredRadius = cameraDistance * diagonal /
    sqrt(
      targetFocalLength * targetFocalLength +
      diagonal * diagonal
    );
  return max(0.82, requiredRadius / safeRadius);
}

@vertex fn vs_backdrop(@builtin(vertex_index) index: u32) -> BackdropOut {
  let positions = array(
    vec2f(-1.0, -3.0),
    vec2f(-1.0, 1.0),
    vec2f(3.0, 1.0)
  );

  let p = positions[index];

  var out: BackdropOut;
  out.position = vec4f(p, 0.5, 1.0);
  out.screenUv = vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  return out;
}

@fragment fn fs_backdrop(in: BackdropOut) -> @location(0) vec4f {
  let aspect = max(u.aspectRatio, 0.001);
  let axis = normalize(vec2f(0.62 * aspect, 0.78));
  let centered = vec2f(
    (in.screenUv.x - 0.5) * aspect,
    in.screenUv.y - 0.5
  );
  let extent = abs(axis.x) * aspect * 0.5 + abs(axis.y) * 0.5;
  let raw = dot(centered, axis) / max(extent * 2.0, 0.0001) + 0.5;
  return gradientAt(balanceRemap(raw));
}

@vertex fn vs_main(in: VsIn) -> VsOut {
  let detail = clamp(u.detail, 0.0, 5.0);
  let rotationTime = u.time * max(u.rotationSpeed, 0.0);
  let aspect = max(u.aspectRatio, 0.001);
  let zoom = clamp(u.zoom, 0.5, 10.0);

  let baseDirection = normalize(in.position);
  let objectPosition = twistedSurfacePoint(baseDirection, detail);
  let rotatedPosition = animatedOrientation(objectPosition, rotationTime);

  let sphereScale = coverSphereScale(aspect);
  let worldPosition = rotatedPosition * sphereScale;
  let cameraDistance = 3.0;
  let viewPosition = worldPosition + vec3f(0.0, 0.0, -cameraDistance);

  let focalLength = 1.73 * zoom;
  let nearPlane = 0.1;
  let farPlane = 10.0;
  let depthA = farPlane / (nearPlane - farPlane);
  let depthB = nearPlane * farPlane / (nearPlane - farPlane);

  var out: VsOut;
  out.position = vec4f(
    viewPosition.x * focalLength / aspect,
    viewPosition.y * focalLength,
    depthA * viewPosition.z + depthB,
    -viewPosition.z
  );
  out.baseDirection = baseDirection;
  out.worldPosition = worldPosition;
  return out;
}

@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  let detail = clamp(u.detail, 0.0, 5.0);
  let rotationTime = u.time * max(u.rotationSpeed, 0.0);
  let morphTime = u.time * max(u.morphSpeed, 0.0);
  let material = i32(u.material + 0.5);
  let shading = clamp(u.shading, 0.0, 1.0);
  let gradientMethod = clamp(i32(u.gradientMethod + 0.5), 0, 2);

  let direction = normalize(in.baseDirection);
  var field = 0.0;
  if (gradientMethod == 0 || material == 4) {
    field = heightField(direction, detail);
  }

  var normal = vec3f(0.0, 0.0, 1.0);
  var viewDirection = vec3f(0.0, 0.0, 1.0);
  var facing = 0.0;
  if (gradientMethod == 2 || material != 0) {
    let objectNormal = twistedFieldNormal(direction, detail);
    normal = normalize(animatedOrientation(objectNormal, rotationTime));
    viewDirection = normalize(vec3f(0.0, 0.0, 3.0) - in.worldPosition);
    facing = max(dot(normal, viewDirection), 0.0);
  }

  var gradientCoordinate = 0.0;
  if (gradientMethod == 2) {
    gradientCoordinate = 1.0 - facing;
  } else {
    gradientCoordinate = objectGradientCoordinate(
      gradientMethod,
      direction,
      field,
      morphTime
    );
  }

  let t = balanceRemap(gradientCoordinate);
  let baseColor = gradientAt(t);

  if (material == 0) {
    return baseColor;
  }

  let keyDirection = normalize(vec3f(-0.45, 0.7, 0.65));
  let fillDirection = normalize(vec3f(0.5, -0.3, 0.4));
  let halfDirection = normalize(keyDirection + viewDirection);

  let key = max(dot(normal, keyDirection), 0.0);
  let fill = max(dot(normal, fillDirection), 0.0) * 0.22;
  let highlight = max(dot(normal, halfDirection), 0.0);

  if (material == 4) {
    let fresnel = pow(1.0 - facing, 3.0);
    let dispersion = 0.025 + fresnel * 0.075;

    let redSample = gradientAt(clamp(t + dispersion, 0.0, 1.0));
    let greenSample = gradientAt(t);
    let blueSample = gradientAt(clamp(t - dispersion, 0.0, 1.0));
    let refractedColor = vec3f(
      redSample.r,
      greenSample.g,
      blueSample.b
    );

    let filmPhase = (
      (1.0 - facing) * 18.0 +
      field * 7.0 +
      morphTime * 0.18
    );
    let filmColor = 0.5 + 0.5 * cos(vec3f(
      filmPhase,
      filmPhase + 2.094,
      filmPhase + 4.188
    ));

    let reflectionDirection = reflect(-viewDirection, normal);
    let skyAmount = clamp(reflectionDirection.y * 0.5 + 0.5, 0.0, 1.0);
    let environmentColor = mix(
      vec3f(0.08, 0.04, 0.16),
      vec3f(0.42, 0.72, 1.0),
      skyAmount
    );

    let glassHighlight = pow(highlight, 120.0);
    let transmission = refractedColor * (0.28 + facing * 0.48);
    let iridescence = filmColor * (0.13 + fresnel * 0.38);
    let reflection = environmentColor * (0.12 + fresnel * 0.7);
    let glassColor = transmission + iridescence + reflection +
      vec3f(glassHighlight * 0.95);

    let glassAlpha = clamp(
      baseColor.a * (0.38 + fresnel * 0.48),
      0.0,
      1.0
    );
    let shadedGlassColor = mix(baseColor.rgb, glassColor, shading);
    let shadedGlassAlpha = mix(baseColor.a, glassAlpha, shading);
    return vec4f(shadedGlassColor, shadedGlassAlpha);
  }

  var ambientAmount = 0.42;
  var diffuseAmount = 0.58;
  var specularAmount = 0.05;
  var specularPower = 8.0;
  var rimAmount = 0.04;
  var rimPower = 3.0;
  var metallic = 0.0;

  if (material == 1) {
    ambientAmount = 0.40;
    diffuseAmount = 0.60;
    specularAmount = 0.14;
    specularPower = 22.0;
    rimAmount = 0.07;
    rimPower = 2.8;
  } else if (material == 2) {
    ambientAmount = 0.34;
    diffuseAmount = 0.60;
    specularAmount = 0.42;
    specularPower = 72.0;
    rimAmount = 0.12;
    rimPower = 2.2;
  } else if (material == 3) {
    ambientAmount = 0.26;
    diffuseAmount = 0.46;
    specularAmount = 0.66;
    specularPower = 54.0;
    rimAmount = 0.18;
    rimPower = 1.8;
    metallic = 0.85;
  }

  let specular = pow(highlight, specularPower) * specularAmount;
  let rim = pow(1.0 - facing, rimPower) * rimAmount;
  let diffuseColor = baseColor.rgb *
    (ambientAmount + (key + fill) * diffuseAmount);
  let dielectricReflection = vec3f(specular + rim);
  let metalReflection = baseColor.rgb * (specular + rim * 1.25);
  let reflection = mix(
    dielectricReflection,
    metalReflection,
    metallic
  );
  let litColor = diffuseColor + reflection;
  let finalColor = mix(baseColor.rgb, litColor, shading);

  return vec4f(finalColor, baseColor.a);
}
`;

  /* --- performance knobs ---------------------------------------------------
     El shader es un degrade suave y de muy baja frecuencia, asi que resolucion
     y antialiasing aportan poco a lo que se ve y mucho al costo. Subi estos
     valores si lo ves blando; bajalos si calienta. ------------------------- */
  var CONFIG = {
    maxDpr: 1,           // 1 = resolucion CSS. 1.5 o 2 = mas nitido y hasta 4x mas caro
    sampleCount: 1,      // 1 = sin MSAA. 4 = como lo exporta Figma
    sphereResolution: 64, // malla del cubo-esfera por cara (Figma usa 112)
    maxFps: 30           // la animacion es lentisima; 60 no se distingue de 30
  };

  /* --- setup / render: from the Figma effect module ------------------------
     El WGSL y la logica son los del modulo exportado. Lo unico cambiado son
     los parametros de CONFIG y el compartir geometria entre los dos canvas. */

  function setup(device, frame, shared) {
    // El modulo WGSL y la malla son identicos para los dos canvas: se crean una
    // sola vez y se comparten. Antes se compilaba y subia la geometria dos veces.
    if (shared.shaderModule) {
      frame.state.shaderModule = shared.shaderModule;
      frame.state.vertexBuffer = shared.vertexBuffer;
      frame.state.indexBuffer = shared.indexBuffer;
      frame.state.indexCount = shared.indexCount;
      frame.state.vertexBuffers = shared.vertexBuffers;
      frame.state.defaultGradientStops = shared.defaultGradientStops;
      frame.state.uniformBuf = device.createBuffer({
        size: 224, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      frame.state.uniformData = new Float32Array(56);
      frame.state.outputTexture = null;
      frame.state.outputView = null;
      frame.state.zoomAspect = Number.NaN;
      frame.state.minimumZoom = 0.5;
      return;
    }
    frame.state.shaderModule = device.createShaderModule({ code: SHADER_WGSL });
    var faces = [
      { right: [0, 0, -1], up: [0, 1, 0] },
      { right: [0, 0, 1], up: [0, 1, 0] },
      { right: [1, 0, 0], up: [0, 0, -1] },
      { right: [1, 0, 0], up: [0, 0, 1] },
      { right: [1, 0, 0], up: [0, 1, 0] },
      { right: [-1, 0, 0], up: [0, 1, 0] }
    ];
    // Six 112x112 cube-sphere faces: 76,614 vertices and 150,528 triangles.
    var resolution = CONFIG.sphereResolution;
    var verticesPerFace = (resolution + 1) * (resolution + 1);
    var vertexCount = faces.length * verticesPerFace;
    var triangleCount = faces.length * resolution * resolution * 2;
    var vertices = new Float32Array(vertexCount * 3);
    var indices = new Uint32Array(triangleCount * 3);
    var vertexOffset = 0;
    var indexOffset = 0;
    for (var f = 0; f < faces.length; f += 1) {
      var right = faces[f].right;
      var up = faces[f].up;
      var forward = [
        right[1] * up[2] - right[2] * up[1],
        right[2] * up[0] - right[0] * up[2],
        right[0] * up[1] - right[1] * up[0]
      ];
      var baseIndex = vertexOffset / 3;
      for (var row = 0; row <= resolution; row += 1) {
        var v = (row / resolution) * 2 - 1;
        for (var column = 0; column <= resolution; column += 1) {
          var uu = (column / resolution) * 2 - 1;
          var x = forward[0] + right[0] * uu + up[0] * v;
          var y = forward[1] + right[1] * uu + up[1] * v;
          var z = forward[2] + right[2] * uu + up[2] * v;
          var x2 = x * x;
          var y2 = y * y;
          var z2 = z * z;
          vertices[vertexOffset] = x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3);
          vertices[vertexOffset + 1] = y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3);
          vertices[vertexOffset + 2] = z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3);
          vertexOffset += 3;
        }
      }
      var rowSize = resolution + 1;
      for (var row2 = 0; row2 < resolution; row2 += 1) {
        for (var col2 = 0; col2 < resolution; col2 += 1) {
          var a = baseIndex + row2 * rowSize + col2;
          var b = a + 1;
          var c = a + rowSize + 1;
          var d = a + rowSize;
          indices[indexOffset] = a;
          indices[indexOffset + 1] = b;
          indices[indexOffset + 2] = c;
          indices[indexOffset + 3] = a;
          indices[indexOffset + 4] = c;
          indices[indexOffset + 5] = d;
          indexOffset += 6;
        }
      }
    }
    frame.state.vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true
    });
    new Float32Array(frame.state.vertexBuffer.getMappedRange()).set(vertices);
    frame.state.vertexBuffer.unmap();
    frame.state.indexBuffer = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true
    });
    new Uint32Array(frame.state.indexBuffer.getMappedRange()).set(indices);
    frame.state.indexBuffer.unmap();
    frame.state.indexCount = indices.length;
    frame.state.uniformBuf = device.createBuffer({
      size: 224,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    frame.state.uniformData = new Float32Array(56);
    frame.state.vertexBuffers = [{
      arrayStride: 12,
      attributes: [{ shaderLocation: 0, format: 'float32x3', offset: 0 }]
    }];
    frame.state.defaultGradientStops = [
      { position: 0, color: { r: 1, g: 0.9137254902, b: 0.6196078431, a: 1 } },
      { position: 0.5, color: { r: 0.5058823529, g: 0.4705882353, b: 1, a: 1 } },
      { position: 1, color: { r: 1, g: 0, b: 0.6078431373, a: 1 } }
    ];
    frame.state.outputTexture = null;
    frame.state.outputView = null;
    frame.state.zoomAspect = Number.NaN;
    frame.state.minimumZoom = 0.5;
    shared.shaderModule = frame.state.shaderModule;
    shared.vertexBuffer = frame.state.vertexBuffer;
    shared.indexBuffer = frame.state.indexBuffer;
    shared.indexCount = frame.state.indexCount;
    shared.vertexBuffers = frame.state.vertexBuffers;
    shared.defaultGradientStops = frame.state.defaultGradientStops;
  }

  function render(device, frame) {
    var s = frame.state;
    var sampleCount = CONFIG.sampleCount;
    if (s.pipelineFormat !== frame.output.format) {
      s.pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: s.shaderModule, entryPoint: 'vs_main', buffers: s.vertexBuffers },
        fragment: { module: s.shaderModule, entryPoint: 'fs_main', targets: [{ format: frame.output.format }] },
        primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'back' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
        multisample: { count: sampleCount }
      });
      s.backdropPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: s.shaderModule, entryPoint: 'vs_backdrop' },
        fragment: { module: s.shaderModule, entryPoint: 'fs_backdrop', targets: [{ format: frame.output.format }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' },
        multisample: { count: sampleCount }
      });
      s.pipelineFormat = frame.output.format;
      s.bindGroup = null;
      s.backdropBindGroup = null;
    }
    if (!s.depthTexture || (sampleCount > 1 && !s.msaaTexture) ||
        s.attachmentWidth !== frame.output.width ||
        s.attachmentHeight !== frame.output.height ||
        s.attachmentFormat !== frame.output.format) {
      if (s.depthTexture) { s.depthTexture.destroy(); }
      if (s.msaaTexture) { s.msaaTexture.destroy(); s.msaaTexture = null; }
      if (sampleCount > 1) {
        s.msaaTexture = device.createTexture({
          size: { width: frame.output.width, height: frame.output.height, depthOrArrayLayers: 1 },
          format: frame.output.format,
          sampleCount: sampleCount,
          usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        s.msaaView = s.msaaTexture.createView();
      }
      s.depthTexture = device.createTexture({
        size: { width: frame.output.width, height: frame.output.height, depthOrArrayLayers: 1 },
        format: 'depth24plus',
        sampleCount: sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
      s.depthView = s.depthTexture.createView();
      s.attachmentWidth = frame.output.width;
      s.attachmentHeight = frame.output.height;
      s.attachmentFormat = frame.output.format;
    }
    var width = frame.output.width;
    var height = Math.max(frame.output.height, 1);
    var aspect = width / height;
    var maximumZoom = 10;
    if (s.zoomAspect !== aspect) {
      var diagonal = Math.sqrt(1 + aspect * aspect);
      var safeRadius = 0.72;
      var cameraDistance = 3;
      var baseFocalLength = 1.73;
      var targetCoverZoom = 4;
      var targetFocalLength = baseFocalLength * targetCoverZoom;
      var requiredRadius = (cameraDistance * diagonal /
        Math.sqrt(targetFocalLength * targetFocalLength + diagonal * diagonal));
      var sphereScale = Math.max(0.82, requiredRadius / safeRadius);
      var conservativeRadius = Math.min(cameraDistance - 0.001, sphereScale * safeRadius);
      var perspectiveDepth = Math.sqrt(Math.max(0.0001,
        cameraDistance * cameraDistance - conservativeRadius * conservativeRadius));
      var unclampedMinimumCoverZoom = (diagonal * perspectiveDepth /
        (baseFocalLength * conservativeRadius)) * 1.12;
      var minimumCoverZoom = Math.min(maximumZoom, Math.max(0.5, unclampedMinimumCoverZoom));
      var zoomOutFactor = 0.65;
      s.minimumZoom = Math.min(maximumZoom, Math.max(0.5, minimumCoverZoom * zoomOutFactor));
      s.zoomAspect = aspect;
    }
    var params = frame.params || {};
    var gradient = params.gradient;
    var stops = gradient && Array.isArray(gradient.stops) && gradient.stops.length > 0
      ? gradient.stops : s.defaultGradientStops;
    var stopCount = Math.min(8, stops.length);
    var detail = params.detail != null ? params.detail : 1.78;
    var intensity = params.intensity != null ? params.intensity : 4.29;
    var zoomPercent = params.zoom != null ? params.zoom : 72;
    var clampedZoomPercent = Math.min(100, Math.max(0, zoomPercent));
    var zoomProgress = clampedZoomPercent / 100;
    var minimumZoom = s.minimumZoom;
    var unclampedZoom = minimumZoom * Math.pow(maximumZoom / minimumZoom, zoomProgress);
    var zoom = Math.min(maximumZoom, Math.max(minimumZoom, unclampedZoom));
    var rotationSpeedPercent = params.rotationSpeed != null ? params.rotationSpeed : 12;
    var clampedRotationSpeedPercent = Math.min(100, Math.max(0, rotationSpeedPercent));
    var rotationSpeed = Math.min(0.25, Math.max(0, (clampedRotationSpeedPercent / 100) * 0.25));
    var morphSpeed = params.morphSpeed != null ? params.morphSpeed : 3.74;
    var material = params.material != null ? params.material : 0;
    var shading = material === 0 ? 0 : 0.5;
    var balancePercent = params.gradientBalance != null ? params.gradientBalance : 0;
    var balance = Math.min(100, Math.max(-100, balancePercent)) / 100;
    var warp = params.warp != null ? params.warp : 0.26;
    var twist = params.twist != null ? params.twist : 0.04;
    var gradientMethod = params.gradientMethod != null ? params.gradientMethod : 0;
    s.uniformData[0] = detail;
    s.uniformData[1] = (frame.time || 0) * 0.001;
    s.uniformData[2] = aspect;
    s.uniformData[3] = stopCount;
    s.uniformData[44] = zoom;
    s.uniformData[45] = morphSpeed;
    s.uniformData[46] = material;
    s.uniformData[47] = rotationSpeed;
    s.uniformData[48] = balance;
    s.uniformData[49] = shading;
    s.uniformData[50] = warp;
    s.uniformData[51] = intensity;
    s.uniformData[52] = twist;
    s.uniformData[53] = gradientMethod;
    for (var i = 0; i < stopCount; i += 1) {
      var stop = stops[i];
      var color = stop && stop.color ? stop.color : { r: 0.2, g: 0.5, b: 1, a: 1 };
      var colorOffset = 4 + i * 4;
      s.uniformData[colorOffset] = color.r;
      s.uniformData[colorOffset + 1] = color.g;
      s.uniformData[colorOffset + 2] = color.b;
      s.uniformData[colorOffset + 3] = color.a;
      s.uniformData[36 + i] = stop ? stop.position : 0;
    }
    device.queue.writeBuffer(s.uniformBuf, 0, s.uniformData);
    if (!s.bindGroup) {
      s.bindGroup = device.createBindGroup({
        layout: s.pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: s.uniformBuf } }]
      });
    }
    if (!s.backdropBindGroup) {
      s.backdropBindGroup = device.createBindGroup({
        layout: s.backdropPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: s.uniformBuf } }]
      });
    }
    if (s.outputTexture !== frame.output) {
      s.outputTexture = frame.output;
      s.outputView = frame.output.createView();
    }
    var encoder = device.createCommandEncoder();
    var pass = encoder.beginRenderPass({
      colorAttachments: [sampleCount > 1 ? {
        view: s.msaaView,
        resolveTarget: s.outputView,
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        storeOp: 'discard'
      } : {
        view: s.outputView,
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: s.depthView,
        depthLoadOp: 'clear',
        depthClearValue: 1,
        depthStoreOp: 'discard'
      }
    });
    pass.setPipeline(s.backdropPipeline);
    pass.setBindGroup(0, s.backdropBindGroup);
    pass.draw(3);
    pass.setPipeline(s.pipeline);
    pass.setBindGroup(0, s.bindGroup);
    pass.setVertexBuffer(0, s.vertexBuffer);
    pass.setIndexBuffer(s.indexBuffer, 'uint32');
    pass.drawIndexed(s.indexCount);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  /* --- host: the bit that replaces Figma's React <ShaderFill> -------------- */

  // Shader parameters exactly as authored on the frame. Neon #dafc08 at both
  // ends of the gradient, white in the middle.
  var NEON = { r: 0.8549019608, g: 0.9882352941, b: 0.0313725490, a: 1 };
  var WHITE = { r: 1, g: 1, b: 1, a: 1 };

  var PARAMS = {
    intensity: 4.289999961853027,
    gradient: {
      stops: [
        { position: 0, color: NEON },
        { position: 0.5, color: WHITE },
        { position: 1, color: NEON }
      ]
    },
    gradientBalance: 0,
    material: 0,
    morphSpeed: 1,
    detail: 1.7799999713897705,
    twist: 0.03999999910593033,
    zoom: 72,
    gradientMethod: 1,
    warp: 0.25999999046325684,
    rotationSpeed: 4
  };

  function mount(canvas, device, shared) {
    var ctx = canvas.getContext('webgpu');
    if (!ctx) { return; }

    var format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device: device, format: format, alphaMode: 'premultiplied' });

    var frame = { state: {}, params: PARAMS, time: 0, output: null };
    setup(device, frame, shared);

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var started = performance.now();
    var raf = 0;
    var visible = true;
    var dead = false;

    function sizeCanvas() {
      var dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
      var rect = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width * dpr));
      var h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    var lastDraw = -1e9;
    var minFrameMs = 1000 / Math.max(1, CONFIG.maxFps) - 1;

    function draw(now) {
      raf = 0;
      if (dead) { return; }
      // Tope de fps: el rAF sigue corriendo pero se saltea el trabajo de GPU.
      if (now - lastDraw < minFrameMs) {
        if (!reduce && visible && document.visibilityState === 'visible') {
          raf = requestAnimationFrame(draw);
        }
        return;
      }
      lastDraw = now;
      sizeCanvas();
      // A still frame for reduced-motion users: same look, no animation.
      frame.time = reduce ? 2000 : (now - started);
      try {
        frame.output = ctx.getCurrentTexture();
        render(device, frame);
      } catch (err) {
        dead = true;
        canvas.style.display = 'none';
        console.warn('[shader] stopped:', err);
        return;
      }
      if (!reduce && visible && document.visibilityState === 'visible') {
        raf = requestAnimationFrame(draw);
      }
    }

    function kick() {
      if (!raf && !dead && visible && document.visibilityState === 'visible') {
        raf = requestAnimationFrame(draw);
      }
    }

    // Only animate while the canvas is actually on screen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) { kick(); }
      }, { threshold: 0 }).observe(canvas);
    }
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('resize', function () {
      if (reduce || dead) { requestAnimationFrame(draw); } else { kick(); }
    });

    requestAnimationFrame(draw);
  }

  function boot() {
    var canvases = document.querySelectorAll('canvas[data-shader]');
    if (!canvases.length) { return; }
    if (!navigator.gpu) { return; }  // no WebGPU -> the plain background stays

    navigator.gpu.requestAdapter().then(function (adapter) {
      if (!adapter) { return; }
      return adapter.requestDevice().then(function (device) {
        device.addEventListener('uncapturederror', function (e) {
          console.warn('[shader] gpu error:', e.error && e.error.message);
        });
        var shared = {};
        for (var i = 0; i < canvases.length; i += 1) {
          mount(canvases[i], device, shared);
        }
      });
    }).catch(function (err) {
      console.warn('[shader] unavailable:', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
