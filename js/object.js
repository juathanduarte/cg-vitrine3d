class Obj {
  constructor(obj, index) {
    this.objHref = obj.objHref;
    this.index = index;
    this.name = obj.name;
    this.textures = obj.textures;
    this.price = obj.price;
    this.textureIndex = this.textures[0].index;
    this.cameraTarget;
    this.cameraPosition;
    this.position = 0;
    this.animation = false;
    this.direction = 0;
    this.yRotation = degToRad(0);
    this.xRotation = degToRad(0);
    this.fieldOfViewRadians = degToRad(60);
    this.rotationSpeed = 4.2;

    this.insertHTML();

    this.canvas = document.querySelector("#canvas" + String(index));
    this.gl = this.canvas.getContext("webgl2");
    if (!this.gl) {
      return;
    }
    twgl.setAttributePrefix("a_");
    this.meshProgramInfo = twgl.createProgramInfo(this.gl, [
      vertexShaderSource,
      fragmentShaderSource,
    ]);

    this.render = this.render.bind(this);

    this.main();
  }

  insertHTML() {
    var ulOptions = `<ul id="my-select${this.index}" class="buttons-textures">`;

    this.textures.forEach((texture) => {
      texture.index == "1"
        ? (ulOptions += `<li value="${texture.index}" id="op${texture.index}" class="selected" style="background-color: ${texture.inputColor}";></li>`)
        : (ulOptions += `<li value="${texture.index}" id="op${texture.index}" style="background-color: ${texture.inputColor}";></li>`);
    });

    ulOptions += `</ul>`;

    const card = `
      <div class="product">
        <canvas id="canvas${String(this.index)}"></canvas>
          <div class="product-header">
            <h2>${this.name} - ${this.price} $</h2>
          </div>

          <div class="animations">
            <div>
                <p>Rotação Y</p>
                <input type="range" min="0" max="360" id="roty${String(
                  this.index
                )}" value="0">
            </div>

            <div>
                <p>Rotação X</p>
                <input type="range" min="0" max="720" id="rotx${String(
                  this.index
                )}" value="0">
            </div>

            <div>
                <p>Zoom</p>
                <input type="range" min="0" max="40" id="zoom${String(
                  this.index
                )}" value="0">
                </div>
            </div>

            <div class="product-footer">
              <button id="ani${String(this.index)}">Animar</button>
              <button id="button-cart${String(this.index)}">Comprar</button>
            </div>
            ${ulOptions}
        </div>
    `;
    const div = document.createElement("div");
    div.innerHTML = card.trim();

    const cardSection = document.getElementById("container-items");
    cardSection.appendChild(div.firstChild);

    //inputs range
    const zoom = document.getElementById("zoom" + String(this.index));
    zoom.addEventListener("input", () => {
      const val = parseInt(zoom.value) * -0.04 + 5;
      this.cameraPosition[2] = val;
    });

    const rotY = document.getElementById("roty" + String(this.index));
    rotY.addEventListener("input", () => {
      const val = degToRad(parseInt(rotY.value));
      this.yRotation = val;
    });

    const rotX = document.getElementById("rotx" + String(this.index));
    rotX.addEventListener("input", () => {
      const val = degToRad(parseInt(rotX.value));
      this.xRotation = val;
    });

    var lis = document.querySelectorAll(`#my-select${this.index} li`);
    lis.forEach((li) => {
      li.addEventListener("click", () => {
        lis.forEach((otherLi) => {
          otherLi.classList.remove("selected");
        });
        li.classList.add("selected");

        this.textureIndex = String(li.value);
        this.loadTexture();
      });
    });

    const buttonCart = document.getElementById(
      "button-cart" + String(this.index)
    );
    buttonCart.addEventListener("click", () => {
      buyBeer(this.name, this.objHref, this.textureIndex, this.price);
    });

    const buttonAnimation = document.getElementById("ani" + String(this.index));
    buttonAnimation.addEventListener("click", () => {
      this.animation = !this.animation;

      if (!this.animation) {
        this.cameraPosition[0] = 0;
        this.position = 0;
      }
    });
  }

  async main() {
    const response = await fetch(this.objHref);
    const text = await response.text();
    this.obj = parseOBJ(text);

    await this.loadTexture();

    const extents = this.getGeometriesExtents(this.obj.geometries);
    const range = m4.subtractVectors(extents.max, extents.min);
    this.objOffset = m4.scaleVector(
      m4.addVectors(extents.min, m4.scaleVector(range, 0.5)),
      -1
    );

    const radius = m4.length(range) * 1.0;
    this.cameraTarget = [0, 2, 0];
    this.cameraPosition = m4.addVectors(this.cameraTarget, [0, 0, radius]);

    this.zNear = radius / 50;
    this.zFar = radius * 5;

    requestAnimationFrame(this.render);
  }

  async loadTexture() {
    const baseHref = new URL(this.objHref, window.location.href);
    const matTexts = await Promise.all(
      this.obj.materialLibs.map(async (filename) => {
        const matHref = new URL(filename, baseHref).href;
        const novaString =
          matHref.substring(0, matHref.indexOf(".mtl")) +
          this.textureIndex +
          ".mtl";
        const response = await fetch(novaString);
        return await response.text();
      })
    );
    this.materials = parseMTL(matTexts.join("\n"));

    const textures = {
      defaultWhite: twgl.createTexture(this.gl, { src: [255, 255, 255, 255] }),
      defaultNormal: twgl.createTexture(this.gl, { src: [127, 127, 255, 0] }),
    };

    for (const material of Object.values(this.materials)) {
      Object.entries(material)
        .filter(([key]) => key.endsWith("Map"))
        .forEach(([key, filename]) => {
          let texture = textures[filename];
          if (!texture) {
            const textureHref = new URL(filename, baseHref).href;
            texture = twgl.createTexture(this.gl, {
              src: textureHref,
              flipY: true,
            });
            textures[filename] = texture;
          }
          material[key] = texture;
        });
    }

    Object.values(this.materials).forEach((m) => {
      m.shininess = 25;
      m.specular = [3, 2, 1];
    });

    const defaultMaterial = {
      diffuse: [1, 1, 1],
      diffuseMap: textures.defaultWhite,
      normalMap: textures.defaultNormal,
      ambient: [0, 0, 0],
      specular: [1, 1, 1],
      specularMap: textures.defaultWhite,
      shininess: 400,
      opacity: 1,
    };

    this.parts = this.obj.geometries.map(({ material, data }) => {
      if (data.color) {
        if (data.position.length === data.color.length) {
          data.color = { numComponents: 3, data: data.color };
        }
      } else {
        data.color = { value: [1, 1, 1, 1] };
      }

      if (data.texcoord && data.normal) {
        data.tangent = generateTangents(data.position, data.texcoord);
      } else {
        data.tangent = { value: [1, 0, 0] };
      }

      if (!data.texcoord) {
        data.texcoord = { value: [0, 0] };
      }

      if (!data.normal) {
        data.normal = { value: [0, 0, 1] };
      }

      const bufferInfo = twgl.createBufferInfoFromArrays(this.gl, data);
      const vao = twgl.createVAOFromBufferInfo(
        this.gl,
        this.meshProgramInfo,
        bufferInfo
      );
      return {
        material: {
          ...defaultMaterial,
          ...this.materials[material],
        },
        bufferInfo,
        vao,
      };
    });
  }

  getExtents(positions) {
    const min = positions.slice(0, 3);
    const max = positions.slice(0, 3);
    for (let i = 3; i < positions.length; i += 3) {
      for (let j = 0; j < 3; ++j) {
        const v = positions[i + j];
        min[j] = Math.min(v, min[j]);
        max[j] = Math.max(v, max[j]);
      }
    }
    return { min, max };
  }

  getGeometriesExtents(geometries) {
    return geometries.reduce(
      ({ min, max }, { data }) => {
        const minMax = this.getExtents(data.position);
        return {
          min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
          max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
        };
      },
      {
        min: Array(3).fill(Number.POSITIVE_INFINITY),
        max: Array(3).fill(Number.NEGATIVE_INFINITY),
      }
    );
  }

  render() {
    twgl.resizeCanvasToDisplaySize(this.gl.canvas);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.CULL_FACE);

    const fieldOfViewRadians = degToRad(60);
    const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
    const projection = m4.perspective(
      fieldOfViewRadians,
      aspect,
      this.zNear,
      this.zFar
    );

    const up = [0, 1, 0];

    if (this.animation) this.rotateObject();

    const camera = m4.lookAt(this.cameraPosition, this.cameraTarget, up);

    const view = m4.inverse(camera);

    const sharedUniforms = {
      u_lightDirection: m4.normalize([-1, 3, 5]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: this.cameraPosition,
    };
    this.gl.useProgram(this.meshProgramInfo.program);

    twgl.setUniforms(this.meshProgramInfo, sharedUniforms);

    let u_world = m4.identity();
    u_world = m4.translate(u_world, ...this.objOffset);
    u_world = m4.yRotation(this.yRotation);
    u_world = m4.multiply(m4.xRotation(this.xRotation), u_world);

    for (const { bufferInfo, vao, material } of this.parts) {
      this.gl.bindVertexArray(vao);
      twgl.setUniforms(
        this.meshProgramInfo,
        {
          u_world,
        },
        material
      );
      twgl.drawBufferInfo(this.gl, bufferInfo);
    }
    requestAnimationFrame(this.render);
  }

  rotateObject() {
    this.yRotation += this.rotationSpeed / 60.0;
  }
}

async function loadObjs() {
  const response = await fetch("../data/objects.json");
  const text = await response.text();
  const objs = JSON.parse(text);

  const arrayObjs = [];

  objs.forEach((obj, indice) => {
    arrayObjs.push(new Obj(obj, indice));
  });
}

loadObjs();
