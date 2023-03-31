const degToRad = (d) => (d * Math.PI) / 180;

const radToDeg = (r) => (r * 180) / Math.PI;

const buyObject = (name, objHref, textures) => {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];

  obj = {
    name: name,
    href: objHref,
    textures: textures,
  };

  cart.push(obj);
  localStorage.setItem("cart", JSON.stringify(cart));
};
