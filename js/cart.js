class Obj {
  constructor(obj, index) {
    this.objHref = obj.href;
    this.index = index;
    this.name = obj.name;
    this.textures = obj.textures;
    this.price = obj.price;
    this.textureIndex = this.textures[0].index;

    this.cameraTarget;
    this.cameraPosition;
    this.linePosition = Math.random() > 0.5 ? 1 * index : -1 * index;

    this.targetAngleRadians = 100;
    this.targetRadius = 360;
    this.fieldOfViewRadians = degToRad(60);
    this.rotationSpeed = 4.2;
    this.cameraAngleRadians = Math.PI / 4;

    this.isAnimated = true;

    this.a = 4; // raio horizontal
    this.b = 4; // raio vertical
    this.c = 3; // raio de profundidade
    this.t = 0; // parâmetro da curva

    this.yRotation = degToRad(0);
    this.xRotation = degToRad(0);

    this.canvas = document.querySelector("#cart");
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

  async main() {
    const response = await fetch(this.objHref);
    const text = await response.text();
    this.obj = parseOBJ(text);

    await this.loadTexture();

    const extents = this.getGeometriesExtents(this.obj.geometries);
    const range = m4.subtractVectors(extents.max, extents.min);
    // amount to move the object so its center is at the origin
    this.objOffset = m4.scaleVector(
      m4.addVectors(extents.min, m4.scaleVector(range, 0.5)),
      -1
    );

    // figure out how far away to move the camera so we can likely
    // see the object.
    this.radius = m4.length(range) * 4;
    this.c = this.radius;
    this.cameraTarget = [this.linePosition, 1, 2];
    this.cameraPosition = m4.addVectors(this.cameraTarget, [0, 0, this.radius]);

    this.zNear = this.radius / 50;
    this.zFar = this.radius * 3;

    requestAnimationFrame(this.render);
  }

  async loadTexture() {
    const baseHref = new URL(this.objHref, window.location.href);
    const matTexts = await Promise.all(
      this.obj.materialLibs.map(async (filename) => {
        const matHref = new URL(filename, baseHref).href;
        // console.log("matHref", matHref);
        const novaString =
          matHref.substring(0, matHref.indexOf(".mtl")) +
          this.textures +
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

    // load texture for materials
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

    // hack the materials so we can see the specular map
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
      shininess: 200,
      opacity: 1,
    };

    this.parts = this.obj.geometries.map(({ material, data }) => {
      if (data.color) {
        if (data.position.length === data.color.length) {
          // it's 3. The our helper library assumes 4 so we need
          // to tell it there are only 3.
          data.color = { numComponents: 3, data: data.color };
        }
      } else {
        // there are no vertex colors so just use constant white
        data.color = { value: [1, 1, 1, 1] };
      }

      // generate tangents if we have the data to do so.
      if (data.texcoord && data.normal) {
        data.tangent = generateTangents(data.position, data.texcoord);
      } else {
        // There are no tangents
        data.tangent = { value: [1, 0, 0] };
      }

      if (!data.texcoord) {
        data.texcoord = { value: [0, 0] };
      }

      if (!data.normal) {
        // we probably want to generate normals if there are none
        data.normal = { value: [0, 0, 1] };
      }

      // create a buffer for each array by calling
      // gl.createBuffer, gl.bindBuffer, gl.bufferData
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
    // console.log("this.gl.canvas.width", this.gl.canvas.width);
    // console.log("this.gl.canvas.height", this.gl.canvas.height);
    this.gl.enable(this.gl.DEPTH_TEST);

    const fieldOfViewRadians = degToRad(60);
    const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
    const projection = m4.perspective(
      fieldOfViewRadians,
      aspect,
      this.zNear,
      this.zFar
    );

    const up = [0, 1, 0];

    if (this.isAnimated) this.animation();

    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(this.cameraPosition, this.cameraTarget, up);

    // Make a view matrix from the camera matrix.
    const view = m4.inverse(camera);

    const sharedUniforms = {
      u_lightDirection: m4.normalize([-1.5, 2, 2]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: this.cameraPosition,
    };

    this.gl.useProgram(this.meshProgramInfo.program);

    // calls gl.uniform
    twgl.setUniforms(this.meshProgramInfo, sharedUniforms);

    // compute the world matrix once since all parts
    // are at the same space.
    let u_world = m4.identity();
    u_world = m4.translate(u_world, ...this.objOffset);
    u_world = m4.yRotation(this.yRotation);
    u_world = m4.multiply(m4.xRotation(this.xRotation), u_world);

    for (const { bufferInfo, vao, material } of this.parts) {
      // set the attributes for this part.
      this.gl.bindVertexArray(vao);
      // calls gl.uniform
      twgl.setUniforms(
        this.meshProgramInfo,
        {
          u_world,
        },
        material
      );
      // calls gl.drawArrays or gl.drawElements
      twgl.drawBufferInfo(this.gl, bufferInfo);
    }
    requestAnimationFrame(this.render);
  }
  animation() {
    const x = this.a * Math.cos(this.t);
    const y = this.b * Math.sin(this.t);
    const z = this.c * Math.sin(this.t);

    this.cameraPosition[0] = x;
    this.cameraPosition[1] = y;
    this.cameraPosition[2] = z;

    this.t += 0.01;
  }
}

async function loadObjs() {
  //load the cart from the local storage
  var cart = JSON.parse(localStorage.getItem("cart"));
  // console.log(cart);

  const arrayItems = [];

  //change the innerHTML of the total
  if (cart == null) {
    cart = [];
  }

  //create the objects
  cart.forEach((item, indice) => {
    arrayItems.push(new Obj(item, indice));
  });

  totalPrice();
}

loadObjs();
