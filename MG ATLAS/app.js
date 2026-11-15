(function () {
  "use strict";

  const data = window.TRAVEL_DATA;
  const languageSelect = document.getElementById("language-select");
  const citySelect = document.getElementById("city-select");
  const categorySelect = document.getElementById("category-select");
  const countryGrid = document.getElementById("country-grid");
  const cityGrid = document.getElementById("city-grid");
  const citySearch = document.getElementById("city-search");
  const directoryCount = document.getElementById("directory-count");
  const cityCount = document.getElementById("city-count");
  const placeGrid = document.getElementById("place-grid");
  const cityTitle = document.getElementById("city-title");
  const citySummary = document.getElementById("city-summary");
  const cityCountry = document.getElementById("city-country");
  const citySourceLink = document.getElementById("city-source-link");
  const placeCount = document.getElementById("place-count");
  const mapElement = document.getElementById("map");
  const mapLabel = document.querySelector(".map-label");
  const solarCanvas = document.getElementById("solar-canvas");
  const weatherPanel = document.getElementById("city-weather");
  const weatherCityLabel = document.getElementById("weather-city-label");
  const weatherUpdated = document.getElementById("weather-updated");
  const weatherContent = document.getElementById("weather-content");
  let language = localStorage.getItem("rahnegar-language") || "fa";
  let selectedCityId = "tehran";
  let selectedCategory = "all";
  let map = null;
  let markers = [];
  let lenis = null;
  const weatherCache = new Map();
  let weatherController = null;
  let weatherRequestId = 0;

  function initializeMotion() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion && window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      gsap.utils.toArray(".section-heading, .map-copy, .map-frame, .editorial-note").forEach(function (element) {
        gsap.from(element, {
          autoAlpha: 0,
          y: 28,
          duration: 0.8,
          ease: "power2.out",
          scrollTrigger: { trigger: element, start: "top 88%", once: true }
        });
      });
    }

    if (window.Lenis && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true, anchors: true });
      if (window.gsap) {
        gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
        if (window.ScrollTrigger) lenis.on("scroll", ScrollTrigger.update);
      } else {
        function raf(time) {
          lenis.raf(time);
          requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
      }
    }
  }

  function initializeSolarSystem() {
    if (!window.THREE || !THREE.OrbitControls || !THREE.EffectComposer || !THREE.UnrealBloomPass || !solarCanvas) {
      document.body.classList.add("solar-unavailable");
      console.error("Solar system rendering requires Three.js, OrbitControls, and the post-processing scripts.");
      return;
    }

    try {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const renderer = new THREE.WebGLRenderer({
        canvas: solarCanvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x0d0d0f, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      else if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
      camera.position.set(0, 7, 62);
      const controls = new THREE.OrbitControls(camera, solarCanvas);
      controls.target.set(0, 0, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.045;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.enableRotate = false;

      const composer = new THREE.EffectComposer(renderer);
      composer.addPass(new THREE.RenderPass(scene, camera));
      composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), 0.58, 0.72, 0.3));

      scene.add(new THREE.AmbientLight(0x171b2b, 0.34));
      const sunPosition = new THREE.Vector3(-17, 0, 0);
      const sunlight = new THREE.PointLight(0xffc98d, 5.5, 170, 1.7);
      sunlight.position.copy(sunPosition);
      scene.add(sunlight);

      const sunUniforms = { uTime: { value: 0 }, uSunMap: { value: null }, uHasMap: { value: 0 } };
      const sunMaterial = new THREE.ShaderMaterial({
        uniforms: sunUniforms,
        vertexShader: [
          "varying vec2 vUv;",
          "void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        ].join("\n"),
        fragmentShader: [
          "varying vec2 vUv;",
          "uniform float uTime;",
          "uniform sampler2D uSunMap;",
          "uniform float uHasMap;",
          "float hash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }",
          "float noise(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y), mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }",
          "void main() { vec2 uv = vUv; vec3 p = vec3(uv * vec2(5.5, 3.0), uTime * 0.08); float n = noise(p) * 0.62 + noise(p * 2.1 + 3.7) * 0.25 + noise(p * 4.3 - 1.2) * 0.13; float granulation = noise(p * 8.0) * 0.12; float plasma = smoothstep(0.27, 0.88, n + granulation); vec3 color = mix(vec3(0.55,0.055,0.006), vec3(1.0,0.31,0.035), plasma); color = mix(color, vec3(1.0,0.82,0.39), smoothstep(0.72,0.98,n)); vec3 surface = texture2D(uSunMap, uv).rgb; color = mix(color, surface * vec3(1.2,0.88,0.62), uHasMap * 0.78); gl_FragColor = vec4(color * 1.35, 1.0); }"
        ].join("\n")
      });
      const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 96, 96), sunMaterial);
      sun.position.copy(sunPosition);
      scene.add(sun);

      const coronaMaterial = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0xff722d) }, uOpacity: { value: 0.42 } },
        vertexShader: [
          "varying vec3 vNormal;",
          "varying vec3 vViewPosition;",
          "void main() { vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vViewPosition = -mvPosition.xyz; gl_Position = projectionMatrix * mvPosition; }"
        ].join("\n"),
        fragmentShader: [
          "uniform vec3 uColor;",
          "uniform float uOpacity;",
          "varying vec3 vNormal;",
          "varying vec3 vViewPosition;",
          "void main() { float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0), 2.25); gl_FragColor = vec4(uColor, fresnel * uOpacity); }"
        ].join("\n"),
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      [1.12, 1.26].forEach(function (scale, index) {
        const glow = new THREE.Mesh(new THREE.SphereGeometry(5 * scale, 64, 64), coronaMaterial.clone());
        glow.position.copy(sunPosition);
        glow.material.uniforms.uOpacity.value = index === 0 ? 0.5 : 0.2;
        scene.add(glow);
      });

      const textureLoader = new THREE.TextureLoader();
      textureLoader.setCrossOrigin("anonymous");
      const threeTextures = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/";
      const solarTextures = "https://raw.githubusercontent.com/yogeshkumarsaini/Solar-System/main/img/";
      function loadTexture(url, onLoad, label) {
        textureLoader.load(url, function (texture) {
          onLoad(texture);
        }, undefined, function (error) {
          console.error("Could not load " + label + " texture.", error);
        });
      }
      function roughnessFromSpecular(texture) {
        const canvas = document.createElement("canvas");
        canvas.width = texture.image.naturalWidth || texture.image.width;
        canvas.height = texture.image.naturalHeight || texture.image.height;
        const context = canvas.getContext("2d");
        if (!context) {
          console.error("Could not create a canvas for the Earth roughness map.");
          return null;
        }
        try {
          context.drawImage(texture.image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
          for (let index = 0; index < pixels.data.length; index += 4) {
            pixels.data[index] = 255 - pixels.data[index];
            pixels.data[index + 1] = 255 - pixels.data[index + 1];
            pixels.data[index + 2] = 255 - pixels.data[index + 2];
          }
          context.putImageData(pixels, 0, 0);
          const roughness = new THREE.CanvasTexture(canvas);
          roughness.encoding = THREE.LinearEncoding;
          return roughness;
        } catch (error) {
          console.error("Could not derive the Earth roughness map from its specular map.", error);
          return null;
        }
      }
      loadTexture(solarTextures + "sun_hd.jpg", function (texture) {
        texture.encoding = THREE.sRGBEncoding;
        sunUniforms.uSunMap.value = texture;
        sunUniforms.uHasMap.value = 1;
      }, "Sun surface");

      function fallbackTexture(seed, colors, banded) {
        const canvas = document.createElement("canvas");
        canvas.width = 768;
        canvas.height = 384;
        const context = canvas.getContext("2d");
        const image = context.createImageData(canvas.width, canvas.height);
        function noise(x, y) {
          const value = Math.sin((x + seed * 31) * 12.9898 + (y + seed * 13) * 78.233) * 43758.5453;
          return value - Math.floor(value);
        }
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const wave = banded
              ? Math.sin(y * 0.12 + Math.sin(x * 0.018 + seed) * 2.5) * 0.5 + 0.5
              : noise(Math.floor(x / 8), Math.floor(y / 8));
            const variation = 0.68 + wave * 0.38 + noise(x, y) * 0.16;
            const index = (y * canvas.width + x) * 4;
            image.data[index] = Math.min(255, colors[0] * variation);
            image.data[index + 1] = Math.min(255, colors[1] * variation);
            image.data[index + 2] = Math.min(255, colors[2] * variation);
            image.data[index + 3] = 255;
          }
        }
        context.putImageData(image, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.encoding = THREE.sRGBEncoding;
        return texture;
      }

      const planetDefinitions = [
        { name: "Mercury", distance: 8, size: 0.34, color: [130, 120, 110], map: solarTextures + "mercury_hd.jpg", seed: 1 },
        { name: "Venus", distance: 11, size: 0.54, color: [194, 146, 86], map: solarTextures + "venus_hd.jpg", seed: 2, banded: true },
        { name: "Earth", distance: 15, size: 0.68, color: [54, 105, 163], map: threeTextures + "earth_atmos_2048.jpg", seed: 3 },
        { name: "Mars", distance: 20, size: 0.47, color: [178, 76, 48], map: solarTextures + "mars_hd.jpg", seed: 4 },
        { name: "Jupiter", distance: 29, size: 1.55, color: [190, 143, 104], map: solarTextures + "jupiter_hd.jpg", seed: 5, banded: true },
        { name: "Saturn", distance: 39, size: 1.24, color: [195, 164, 112], map: solarTextures + "saturn_hd.jpg", seed: 6, banded: true }
      ];
      const planets = {};
      const earthNormalUrl = threeTextures + "earth_normal_2048.jpg";
      const earthSpecularUrl = threeTextures + "earth_specular_2048.jpg";
      const earthCloudsUrl = threeTextures + "earth_clouds_1024.png";
      const ringUrl = solarTextures + "saturn_ring.jpg";
      const planetOrbits = [];
      const destinationPins = {};

      planetDefinitions.forEach(function (definition, index) {
        const orbit = new THREE.Group();
        orbit.position.copy(sunPosition);
        orbit.rotation.y = index * 0.02;
        scene.add(orbit);

        const orbitPoints = [];
        for (let point = 0; point <= 256; point += 1) {
          const angle = point / 256 * Math.PI * 2;
          orbitPoints.push(new THREE.Vector3(Math.cos(angle) * definition.distance, 0, Math.sin(angle) * definition.distance));
        }
        const orbitLine = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(orbitPoints),
          new THREE.LineBasicMaterial({ color: index === 2 ? 0x426cff : 0x7584b8, transparent: true, opacity: index === 2 ? 0.12 : 0.06 })
        );
        orbit.add(orbitLine);

        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: definition.name === "Earth" ? 0.9 : 0.82,
          metalness: 0.025
        });
        material.map = fallbackTexture(definition.seed, definition.color, Boolean(definition.banded));
        material.needsUpdate = true;
        loadTexture(definition.map, function (texture) {
          texture.encoding = THREE.sRGBEncoding;
          material.map = texture;
          material.needsUpdate = true;
        }, definition.name);

        const body = new THREE.Group();
        body.position.x = definition.distance;
        orbit.add(body);
        const rotationGroup = definition.name === "Earth" ? new THREE.Group() : body;
        if (rotationGroup !== body) body.add(rotationGroup);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(definition.size, 64, 48),
          material
        );
        rotationGroup.add(mesh);
        planets[definition.name] = { orbit: orbit, body: body, mesh: mesh, rotationGroup: rotationGroup, size: definition.size };
        planetOrbits.push({ orbit: orbit, index: index });

        if (definition.name === "Earth") {
          loadTexture(earthNormalUrl, function (texture) {
            material.normalMap = texture;
            material.normalScale.set(0.34, 0.34);
            material.needsUpdate = true;
          }, "Earth normal");
          loadTexture(earthSpecularUrl, function (texture) {
            const roughnessMap = roughnessFromSpecular(texture);
            if (roughnessMap) {
              material.roughnessMap = roughnessMap;
              material.roughness = 0.82;
              material.needsUpdate = true;
            }
          }, "Earth specular/roughness");

          const cloudMaterial = new THREE.MeshStandardMaterial({
            color: 0xe7eeff,
            transparent: true,
            opacity: 0.48,
            depthWrite: false,
            roughness: 1
          });
          const clouds = new THREE.Mesh(new THREE.SphereGeometry(definition.size * 1.012, 64, 48), cloudMaterial);
          body.add(clouds);
          planets.Earth.clouds = clouds;
          loadTexture(earthCloudsUrl, function (texture) {
            cloudMaterial.map = texture;
            cloudMaterial.alphaMap = texture;
            cloudMaterial.needsUpdate = true;
          }, "Earth cloud");

          const atmosphere = new THREE.Mesh(
            new THREE.SphereGeometry(definition.size * 1.075, 64, 48),
            new THREE.ShaderMaterial({
              uniforms: { uColor: { value: new THREE.Color(0x3878ff) }, uOpacity: { value: 0.58 } },
              vertexShader: [
                "varying vec3 vNormal;",
                "varying vec3 vViewPosition;",
                "void main() { vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vViewPosition = -mvPosition.xyz; gl_Position = projectionMatrix * mvPosition; }"
              ].join("\n"),
              fragmentShader: [
                "uniform vec3 uColor;",
                "uniform float uOpacity;",
                "varying vec3 vNormal;",
                "varying vec3 vViewPosition;",
                "void main() { float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0), 3.0); gl_FragColor = vec4(uColor, fresnel * uOpacity); }"
              ].join("\n"),
              side: THREE.BackSide,
              transparent: true,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          );
          rotationGroup.add(atmosphere);

          function surfacePoint(latitude, longitude, radius) {
            const lat = THREE.MathUtils.degToRad(latitude);
            const lon = THREE.MathUtils.degToRad(longitude);
            return new THREE.Vector3(
              radius * Math.cos(lat) * Math.cos(lon),
              radius * Math.sin(lat),
              radius * Math.cos(lat) * Math.sin(lon)
            );
          }
          [
            { code: "IRN", lat: 35.6892, lon: 51.389 },
            { code: "RUS", lat: 55.7558, lon: 37.6173 },
            { code: "ARE", lat: 24.4539, lon: 54.3773 },
            { code: "CHN", lat: 39.9042, lon: 116.4074 }
          ].forEach(function (destination) {
            const markerPosition = surfacePoint(destination.lat, destination.lon, definition.size * 1.09);
            const marker = new THREE.Mesh(
              new THREE.SphereGeometry(0.01, 16, 12),
              new THREE.MeshBasicMaterial({ color: 0x6d8cff })
            );
            marker.position.copy(markerPosition);
            marker.userData.destination = destination.code;
            rotationGroup.add(marker);
            const halo = new THREE.Mesh(
              new THREE.SphereGeometry(0.018, 16, 12),
              new THREE.MeshBasicMaterial({ color: 0x0038ff, transparent: true, opacity: 0.5 })
            );
            halo.position.copy(markerPosition);
            rotationGroup.add(halo);
            destinationPins[destination.code] = marker;
          });
        }

        if (definition.name === "Saturn") {
          const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0xd7c5a1,
            transparent: true,
            opacity: 0.88,
            side: THREE.DoubleSide,
            roughness: 0.9,
            depthWrite: false
          });
          const rings = new THREE.Mesh(new THREE.RingGeometry(definition.size * 1.25, definition.size * 2.08, 128), ringMaterial);
          rings.rotation.x = Math.PI / 2.18;
          body.add(rings);
          loadTexture(ringUrl, function (texture) {
            texture.encoding = THREE.sRGBEncoding;
            ringMaterial.map = texture;
            ringMaterial.alphaMap = texture;
            ringMaterial.needsUpdate = true;
          }, "Saturn ring");
        }
      });

      function addPointCloud(count, radius, sizeRange, tint, opacity) {
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        let seed = count + radius;
        function random() {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        }
        for (let index = 0; index < count; index += 1) {
          const theta = random() * Math.PI * 2;
          const z = random() * 2 - 1;
          const radial = Math.sqrt(1 - z * z) * radius;
          positions[index * 3] = Math.cos(theta) * radial;
          positions[index * 3 + 1] = z * radius;
          positions[index * 3 + 2] = Math.sin(theta) * radial;
          const warmth = random();
          colors[index * 3] = THREE.MathUtils.lerp(tint[0], 1, warmth * 0.35);
          colors[index * 3 + 1] = THREE.MathUtils.lerp(tint[1], 0.83, warmth * 0.2);
          colors[index * 3 + 2] = THREE.MathUtils.lerp(tint[2], 0.62, warmth * 0.12);
          sizes[index] = THREE.MathUtils.lerp(sizeRange[0], sizeRange[1], random());
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
        const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
          uniforms: { uOpacity: { value: opacity } },
          vertexShader: [
            "attribute vec3 aColor;",
            "attribute float aSize;",
            "varying vec3 vColor;",
            "void main() { vColor = aColor; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * (260.0 / max(1.0, -mvPosition.z)); gl_Position = projectionMatrix * mvPosition; }"
          ].join("\n"),
          fragmentShader: [
            "uniform float uOpacity;",
            "varying vec3 vColor;",
            "void main() { float radius = length(gl_PointCoord - 0.5); float alpha = 1.0 - smoothstep(0.22, 0.5, radius); gl_FragColor = vec4(vColor, alpha * uOpacity); }"
          ].join("\n"),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        }));
        scene.add(points);
        return points;
      }
      addPointCloud(11000, 92, [0.12, 0.65], [0.62, 0.72, 1], 0.48);
      const nebula = addPointCloud(1500, 48, [0.35, 1.15], [0.16, 0.25, 0.72], 0.065);

      const cameraProgress = { value: 0 };
      const cameraRoute = [
        { at: 0, view: "system" },
        { at: 0.26, view: "earth", distance: 30 },
        { at: 0.47, view: "earth", distance: 11 },
        { at: 0.65, view: "destination", code: "IRN", distance: 2.7 },
        { at: 0.75, view: "destination", code: "ARE", distance: 2.7 },
        { at: 0.84, view: "destination", code: "CHN", distance: 2.7 },
        { at: 0.93, view: "destination", code: "RUS", distance: 2.7 },
        { at: 1, view: "earth", distance: 11 }
      ];
      if (!reducedMotion && window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
        gsap.to(cameraProgress, {
          value: 1,
          ease: "none",
          scrollTrigger: {
            trigger: document.body,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.25,
            invalidateOnRefresh: true
          }
        });
      }

      function resize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height, false);
        composer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      window.addEventListener("resize", resize);
      resize();

      const clock = new THREE.Clock();
      const systemPosition = new THREE.Vector3(0, 7, 62);
      const systemTarget = new THREE.Vector3(0, 0, 0);
      const desiredCameraPosition = new THREE.Vector3();
      const desiredCameraTarget = new THREE.Vector3();
      function cameraPose(routePoint) {
        if (routePoint.view === "system") {
          return { position: systemPosition, target: systemTarget };
        }
        const earthCenter = planets.Earth.body.getWorldPosition(new THREE.Vector3());
        if (routePoint.view === "destination") {
          const pin = destinationPins[routePoint.code];
          const target = pin.getWorldPosition(new THREE.Vector3());
          const direction = target.clone().sub(earthCenter).normalize();
          return { position: target.clone().add(direction.multiplyScalar(routePoint.distance)), target: target };
        }
        const target = earthCenter;
        const direction = new THREE.Vector3(0.11, 0.28, 1).normalize();
        return { position: target.clone().add(direction.multiplyScalar(routePoint.distance)), target: target };
      }
      function render() {
        const elapsed = reducedMotion ? 0 : clock.getElapsedTime();
        sunUniforms.uTime.value = elapsed;
        sun.rotation.y = elapsed * 0.035;
        planets.Earth.mesh.rotation.y = elapsed * 0.025;
        planets.Earth.clouds.rotation.y = elapsed * 0.032;
        planets.Jupiter.mesh.rotation.y = elapsed * 0.018;
        planets.Saturn.mesh.rotation.y = elapsed * 0.012;
        if (!reducedMotion) {
          planetOrbits.forEach(function (item) {
            item.orbit.rotation.y += 0.000035 * (1 + item.index * 0.16);
          });
          nebula.rotation.y = elapsed * 0.002;
        }
        scene.updateMatrixWorld(true);
        const progress = reducedMotion ? 0 : cameraProgress.value;
        let routeIndex = cameraRoute.length - 2;
        for (let index = 0; index < cameraRoute.length - 1; index += 1) {
          if (progress <= cameraRoute[index + 1].at) {
            routeIndex = index;
            break;
          }
        }
        const from = cameraRoute[routeIndex];
        const to = cameraRoute[routeIndex + 1];
        const segmentProgress = THREE.MathUtils.clamp((progress - from.at) / (to.at - from.at), 0, 1);
        const fromPose = cameraPose(from);
        const toPose = cameraPose(to);
        desiredCameraPosition.lerpVectors(fromPose.position, toPose.position, segmentProgress);
        desiredCameraTarget.lerpVectors(fromPose.target, toPose.target, segmentProgress);
        const cameraFollow = reducedMotion ? 1 : 0.16;
        camera.position.lerp(desiredCameraPosition, cameraFollow);
        controls.target.lerp(desiredCameraTarget, cameraFollow);
        controls.update();
        composer.render();
        requestAnimationFrame(render);
      }
      solarCanvas.addEventListener("webglcontextlost", function (event) {
        event.preventDefault();
        document.body.classList.add("solar-unavailable");
        console.error("Solar system rendering stopped because the WebGL context was lost.");
      });
      render();
    } catch (error) {
      document.body.classList.add("solar-unavailable");
      console.error("Solar system rendering could not be initialized.", error);
    }
  }

  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons({ icons: window.lucide.icons });
    }
  }

  function initializeTilt(root) {
    root.querySelectorAll(".country-card, .city-index-card, .place-card").forEach(function (card) {
      if (card.dataset.tiltReady) return;
      card.dataset.tiltReady = "true";
      card.addEventListener("pointermove", function (event) {
        if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        const bounds = card.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        card.style.setProperty("--tilt-x", (y * -3).toFixed(2) + "deg");
        card.style.setProperty("--tilt-y", (x * 3).toFixed(2) + "deg");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
      });
    });
  }

  function localized(value) {
    return value && (value[language] || value.fa || "");
  }

  function weatherCondition(code) {
    const conditions = data.ui[language].weatherConditions;
    const knownCodes = {
      0: "clear", 1: "mostlyClear", 2: "partlyCloudy", 3: "overcast",
      45: "fog", 48: "fog", 51: "drizzle", 53: "drizzle", 55: "drizzle",
      56: "freezingDrizzle", 57: "freezingDrizzle", 61: "rain", 63: "rain",
      65: "rain", 66: "freezingRain", 67: "freezingRain", 71: "snow",
      73: "snow", 75: "snow", 77: "snowGrains", 80: "showers", 81: "showers",
      82: "showers", 85: "snowShowers", 86: "snowShowers", 95: "thunderstorm",
      96: "thunderstormHail", 99: "thunderstormHail"
    };
    const icons = {
      clear: "sun", mostlyClear: "sun", partlyCloudy: "cloud-sun", overcast: "cloud",
      fog: "cloud-fog", drizzle: "cloud-drizzle", freezingDrizzle: "cloud-snow",
      rain: "cloud-rain", freezingRain: "cloud-snow", snow: "cloud-snow",
      snowGrains: "cloud-snow", showers: "cloud-rain", snowShowers: "cloud-snow",
      thunderstorm: "cloud-lightning", thunderstormHail: "cloud-lightning"
    };
    const key = knownCodes[code] || "partlyCloudy";
    return { label: conditions[key], icon: icons[key] };
  }

  function weatherLocale() {
    return { fa: "fa-IR", ar: "ar", ru: "ru-RU", zh: "zh-CN" }[language] || language;
  }

  function formatWeatherDate(date) {
    const parts = date.split("-").map(Number);
    return new Intl.DateTimeFormat(weatherLocale(), { weekday: "short" })
      .format(new Date(parts[0], parts[1] - 1, parts[2]));
  }

  function renderWeather(city, weather) {
    const ui = data.ui[language];
    const currentCondition = weatherCondition(weather.current.weather_code);
    if (!weather.current.is_day && (weather.current.weather_code === 0 || weather.current.weather_code === 1)) {
      currentCondition.icon = "moon";
    }
    const current = weather.current;
    const formatNumber = function (value) {
      return Number(value).toLocaleString(weatherLocale(), { maximumFractionDigits: 0 });
    };
    weatherPanel.setAttribute("aria-busy", "false");
    weatherPanel.classList.remove("weather-error");
    weatherCityLabel.textContent = localized(city.name) + " · " + localized(city.country.names);
    weatherUpdated.textContent = ui.weatherUpdated + " · " + current.time.slice(11, 16);
    weatherContent.innerHTML =
      '<div class="weather-current">' +
        '<div class="weather-primary"><span class="weather-icon"><i data-lucide="' + currentCondition.icon + '" aria-hidden="true"></i></span>' +
          '<div><strong>' + formatNumber(current.temperature_2m) + '°</strong><span>' + currentCondition.label + '</span></div></div>' +
        '<div class="weather-metrics">' +
          '<div><i data-lucide="thermometer" aria-hidden="true"></i><span>' + ui.weatherFeelsLike + '</span><strong>' + formatNumber(current.apparent_temperature) + '°</strong></div>' +
          '<div><i data-lucide="droplets" aria-hidden="true"></i><span>' + ui.weatherHumidity + '</span><strong>' + formatNumber(current.relative_humidity_2m) + '%</strong></div>' +
          '<div><i data-lucide="wind" aria-hidden="true"></i><span>' + ui.weatherWind + '</span><strong>' + formatNumber(current.wind_speed_10m) + ' ' + weather.current_units.wind_speed_10m + '</strong></div>' +
          '<div><i data-lucide="cloud-rain" aria-hidden="true"></i><span>' + ui.weatherRain + '</span><strong>' + formatNumber(current.precipitation) + ' ' + weather.current_units.precipitation + '</strong></div>' +
        '</div>' +
      '</div>' +
      '<div class="weather-forecast"><h3>' + ui.weatherForecast + '</h3><div class="weather-days">' +
        weather.daily.time.map(function (date, index) {
          const forecastCondition = weatherCondition(weather.daily.weather_code[index]);
          return '<div class="weather-day"><span>' + formatWeatherDate(date) + '</span>' +
            '<i data-lucide="' + forecastCondition.icon + '" aria-hidden="true"></i>' +
            '<strong>' + formatNumber(weather.daily.temperature_2m_max[index]) + '°</strong>' +
            '<small>' + formatNumber(weather.daily.temperature_2m_min[index]) + '°</small>' +
            '<small class="weather-day-rain">' + (weather.daily.precipitation_probability_max[index] == null ? "—" : formatNumber(weather.daily.precipitation_probability_max[index]) + "%") + '</small></div>';
        }).join("") +
      '</div></div>' +
      '<a class="weather-source" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">' + ui.weatherSource + '</a>';
    renderIcons();
  }

  function showWeatherError(city, error) {
    const ui = data.ui[language];
    weatherPanel.setAttribute("aria-busy", "false");
    weatherPanel.classList.add("weather-error");
    weatherCityLabel.textContent = localized(city.name) + " · " + localized(city.country.names);
    weatherUpdated.textContent = ui.weatherUnavailable;
    weatherContent.innerHTML = '<div class="weather-error-message"><p>' + ui.weatherError + '</p><button id="weather-retry" type="button" class="weather-retry">' + ui.weatherRetry + '</button></div>';
    document.getElementById("weather-retry").addEventListener("click", function () {
      refreshWeather(city, true);
    });
    console.error("Could not load weather for " + city.id + ".", error);
  }

  function refreshWeather(city, forceRefresh) {
    if (weatherController) weatherController.abort();
    weatherController = null;
    const requestId = ++weatherRequestId;
    const cached = weatherCache.get(city.id);
    if (!forceRefresh && cached && Date.now() - cached.receivedAt < 15 * 60 * 1000) {
      renderWeather(city, cached.data);
      return;
    }

    weatherController = new AbortController();
    const controller = weatherController;
    const ui = data.ui[language];
    weatherPanel.setAttribute("aria-busy", "true");
    weatherPanel.classList.remove("weather-error");
    weatherCityLabel.textContent = localized(city.name) + " · " + localized(city.country.names);
    weatherUpdated.textContent = ui.weatherLoading;
    weatherContent.innerHTML = '<div class="weather-loading" role="status">' + ui.weatherLoading + '</div>';

    const parameters = new URLSearchParams({
      latitude: String(city.coordinates[0]),
      longitude: String(city.coordinates[1]),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      forecast_days: "5",
      timezone: "auto"
    });
    const timeout = window.setTimeout(function () { controller.abort(); }, 12000);
    fetch("https://api.open-meteo.com/v1/forecast?" + parameters.toString(), { signal: controller.signal })
      .then(function (response) {
        if (!response.ok) throw new Error("Weather API returned HTTP " + response.status + ".");
        return response.json();
      })
      .then(function (weather) {
        if (!weather.current || !weather.daily || !Array.isArray(weather.daily.time)) {
          throw new Error("Weather API returned an incomplete forecast.");
        }
        weatherCache.set(city.id, { data: weather, receivedAt: Date.now() });
        if (requestId === weatherRequestId) renderWeather(city, weather);
      })
      .catch(function (error) {
        if (error.name === "AbortError" && requestId !== weatherRequestId) return;
        if (requestId === weatherRequestId) showWeatherError(city, error);
      })
      .finally(function () {
        window.clearTimeout(timeout);
        if (weatherController === controller) weatherController = null;
      });
  }

  function allCities() {
    return data.countries.reduce(function (cities, country) {
      return cities.concat(country.cities.map(function (city) {
        return Object.assign({ country: country }, city);
      }));
    }, []);
  }

  function findCity(cityId) {
    return allCities().find(function (city) { return city.id === cityId; });
  }

  function applyLanguage() {
    const ui = data.ui[language];
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" || language === "ar" ? "rtl" : "ltr";
    document.body.lang = language;
    document.body.dir = document.documentElement.dir;
    solarCanvas.style.transform = document.documentElement.dir === "ltr" ? "scaleX(-1)" : "none";
    document.title = ui.siteTitle;
    document.querySelector('meta[name="description"]').content = ui.metaDescription;
    document.querySelector(".main-nav").setAttribute("aria-label", ui.navLabel);
    document.querySelectorAll(".brand").forEach(function (brand) {
      brand.setAttribute("aria-label", ui.homeLabel);
    });
    document.querySelector(".intro-strip").setAttribute("aria-label", ui.highlightsLabel);

    document.querySelectorAll("[data-i18n]").forEach(function (element) {
      const key = element.dataset.i18n;
      if (ui[key]) element.innerHTML = ui[key];
    });
    languageSelect.value = language;
    languageSelect.setAttribute("aria-label", ui.languageLabel || ui.chooseCity);
    citySearch.setAttribute("placeholder", ui.citySearchPlaceholder);
    citySearch.setAttribute("aria-label", ui.citySearchLabel);
    mapElement.setAttribute("aria-label", ui.mapTitle.replace(/<[^>]*>/g, " "));
    mapLabel.title = ui.mapAttributionHint;
    renderCountries();
    renderCityDirectory(citySearch.value);
    renderCityOptions();
    renderCategories();
    renderCity();
    renderMap();
    revealContent(document);
    initializeTilt(document);
    renderIcons();
    if (!window.L) mapElement.innerHTML = ui.mapUnavailable;
  }

  function renderCountries() {
    const ui = data.ui[language];
    countryGrid.innerHTML = data.countries.map(function (country, index) {
      const capital = country.cities[0];
      return '<article class="country-card">' +
        '<div class="card-top"><span class="country-code">' + country.code + ' / 0' + (index + 1) + '</span><span class="country-symbol" aria-hidden="true">' + country.symbol + '</span></div>' +
        '<h3>' + localized(country.names) + '</h3>' +
        '<span class="country-capital">' + ui.capital + ' · ' + localized(capital.name) + '</span>' +
        '<p>' + localized(country.descriptions) + '</p>' +
        '<a class="card-link" href="#city-guide" data-city="' + capital.id + '"><span>' + ui.visitCountry + '</span><i data-lucide="arrow-up-left" aria-hidden="true"></i></a>' +
        '</article>';
    }).join("");

    countryGrid.querySelectorAll("[data-city]").forEach(function (link) {
      link.addEventListener("click", function () { selectCity(link.dataset.city, true); });
    });
    revealContent(countryGrid);
    initializeTilt(countryGrid);
    renderIcons();
  }

  function renderCityOptions() {
    const ui = data.ui[language];
    const currentValue = selectedCityId;
    citySelect.innerHTML = '<option value="">' + ui.allCapitals + '</option>' +
      allCities().map(function (city) {
        return '<option value="' + city.id + '">' + localized(city.name) + ' · ' + localized(city.country.names) + '</option>';
      }).join("");
    citySelect.value = currentValue;
  }

  function renderCityDirectory(query) {
    const ui = data.ui[language];
    const normalizedQuery = (query || "").trim().toLocaleLowerCase();
    const cities = allCities().filter(function (city) {
      return !normalizedQuery ||
        Object.values(city.name).some(function (name) { return name.toLocaleLowerCase().includes(normalizedQuery); }) ||
        Object.values(city.country.names).some(function (name) { return name.toLocaleLowerCase().includes(normalizedQuery); });
    });
    cityCount.textContent = allCities().length;
    directoryCount.textContent = cities.length;
    if (!cities.length) {
      cityGrid.innerHTML = '<div class="empty-state">' + ui.directoryEmpty + '</div>';
      return;
    }
    cityGrid.innerHTML = cities.map(function (city, index) {
      return '<article class="city-index-card">' +
        '<div class="city-index-top"><span class="city-index-country">' + localized(city.country.names) + '</span><span class="city-index-code">0' + (index + 1) + '</span></div>' +
        '<h3>' + localized(city.name) + '</h3>' +
        '<p>' + localized(city.summary) + '</p>' +
        '<a class="city-index-link" href="#city-guide" data-city="' + city.id + '"><span>' + ui.visitCountry + '</span><i data-lucide="arrow-up-left" aria-hidden="true"></i></a>' +
        '</article>';
    }).join("");
    cityGrid.querySelectorAll("[data-city]").forEach(function (link) {
      link.addEventListener("click", function () { selectCity(link.dataset.city, true); });
    });
    revealContent(cityGrid);
    initializeTilt(cityGrid);
    renderIcons();
  }

  function renderCategories() {
    const ui = data.ui[language];
    categorySelect.innerHTML = data.categories.map(function (category) {
      return '<option value="' + category + '">' + ui.categories[category] + '</option>';
    }).join("");
    categorySelect.value = selectedCategory;
  }

  function renderCity() {
    const ui = data.ui[language];
    const city = findCity(selectedCityId);
    if (!city) return;
    cityTitle.textContent = localized(city.name);
    citySummary.textContent = localized(city.summary);
    cityCountry.textContent = localized(city.country.names);
    refreshWeather(city, false);
    citySourceLink.href = city.sourceUrl;
    citySourceLink.textContent = ui.source + " · " + city.source;
    const places = city.places.filter(function (place) {
      return selectedCategory === "all" || place.category === selectedCategory;
    });
    placeCount.textContent = places.length;
    if (!places.length) {
      placeGrid.innerHTML = '<div class="empty-state">' + ui.placesEmpty + '</div>';
      return;
    }
    placeGrid.innerHTML = places.map(function (place, index) {
      return '<article class="place-card">' +
        '<div class="place-type"><span class="place-category">' + ui.categories[place.category] + '</span><span class="place-number">0' + (index + 1) + '</span></div>' +
        '<h3>' + localized(place.title) + '</h3>' +
        '<p>' + localized(place.description) + '</p>' +
        '<a class="place-source" href="' + place.url + '" target="_blank" rel="noopener noreferrer">' + ui.source + ' · ' + place.source + '<i data-lucide="arrow-up-right" aria-hidden="true"></i></a>' +
        '</article>';
    }).join("");
    revealContent(placeGrid);
    initializeTilt(placeGrid);
    renderIcons();
  }

  function revealContent(root) {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.scrollRevealObserver) {
      window.scrollRevealObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });
    }
    root.querySelectorAll(".section-heading, .intro-strip, .country-card, .city-index-card, .place-card, .map-copy, .map-frame, .editorial-note").forEach(function (element) {
      if (!element.classList.contains("is-visible")) {
        element.classList.add("scroll-reveal");
        window.scrollRevealObserver.observe(element);
      }
    });
  }

  function initializeMap() {
    if (!window.L) {
      mapElement.innerHTML = '<div class="empty-state">' + data.ui[language].mapUnavailable + '</div>';
      return;
    }
    map = L.map(mapElement, { scrollWheelZoom: false, zoomControl: true }).setView([34, 65], 3);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    renderMap();
  }

  function renderMap() {
    if (!map) return;
    markers.forEach(function (marker) { map.removeLayer(marker); });
    markers = [];
    const ui = data.ui[language];
    const city = selectedCityId ? findCity(selectedCityId) : null;
    if (city) {
      const visiblePlaces = city.places.filter(function (place) {
        return selectedCategory === "all" || place.category === selectedCategory;
      });
      const cityMarker = L.marker(city.coordinates, { icon: createMapIcon("⌖") }).addTo(map);
      cityMarker.bindPopup("<strong>" + localized(city.name) + "</strong><br>" + ui.mapAllPopup);
      markers.push(cityMarker);
      visiblePlaces.forEach(function (place) {
        const marker = L.marker(place.coordinates, { icon: createMapIcon("•") }).addTo(map);
        marker.bindPopup("<strong>" + localized(place.title) + "</strong><br>" + ui.categories[place.category]);
        markers.push(marker);
      });
      map.flyToBounds(L.featureGroup(markers).getBounds().pad(0.08), { maxZoom: 12, duration: 1.15 });
    } else {
      allCities().forEach(function (city) {
        const marker = L.marker(city.coordinates, { icon: createMapIcon(city.country.code) }).addTo(map);
        marker.bindPopup("<strong>" + localized(city.name) + "</strong><br>" + localized(city.country.names) + " · " + ui.mapAllPopup);
        marker.on("click", function () { selectCity(city.id, false); });
        markers.push(marker);
      });
      map.flyToBounds(L.featureGroup(markers).getBounds().pad(0.08), { maxZoom: 3, duration: 1.15 });
    }
  }

  function createMapIcon(label) {
    return L.divIcon({
      className: "mg-atlas-map-marker",
      html: '<span class="map-marker-core">' + label + '</span>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  }

  function selectCity(cityId, scrollToGuide) {
    selectedCityId = cityId || null;
    citySelect.value = cityId || "";
    renderCity();
    renderMap();
    if (scrollToGuide) {
      if (lenis) lenis.scrollTo("#city-guide");
      else document.getElementById("city-guide").scrollIntoView({ behavior: "smooth" });
    }
  }

  languageSelect.addEventListener("change", function () {
    language = languageSelect.value;
    localStorage.setItem("rahnegar-language", language);
    applyLanguage();
  });
  citySelect.addEventListener("change", function () {
    selectCity(citySelect.value, false);
  });
  categorySelect.addEventListener("change", function () {
    selectedCategory = categorySelect.value;
    renderCity();
    renderMap();
  });
  citySearch.addEventListener("input", function () {
    renderCityDirectory(citySearch.value);
  });
  document.getElementById("open-map-link").addEventListener("click", function () {
    if (lenis) lenis.scrollTo("#map-section");
    else document.getElementById("map-section").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("year").textContent = new Date().getFullYear();
  if (!data.ui[language]) language = "fa";
  initializeMotion();
  initializeSolarSystem();
  applyLanguage();
  initializeMap();
  window.setInterval(function () {
    if (document.visibilityState !== "visible") return;
    const city = selectedCityId && findCity(selectedCityId);
    if (city) refreshWeather(city, true);
  }, 15 * 60 * 1000);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    const city = selectedCityId && findCity(selectedCityId);
    const cached = city && weatherCache.get(city.id);
    if (city && (!cached || Date.now() - cached.receivedAt >= 15 * 60 * 1000)) refreshWeather(city, true);
  });
})();
