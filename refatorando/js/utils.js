const degToRad = (d) => (d * Math.PI) / 180;

const radToDeg = (r) => (r * 180) / Math.PI;

const buyBeer = (name, objHref, textures, price) => {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];

  obj = {
    name: name,
    href: objHref,
    textures: textures,
    price: price,
  };

  cart.push(obj);
  localStorage.setItem("cart", JSON.stringify(cart));
};

const totalPrice = () => {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  let total = 0;
  cart.forEach((item) => {
    total += Number(item.price);
  });
  document.getElementById("total").innerHTML = `${total}`;
};
