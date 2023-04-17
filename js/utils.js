const degToRad = (d) => (d * Math.PI) / 180; // Recebe um ângulo em graus e retorna o mesmo ângulo em radianos.

const radToDeg = (r) => (r * 180) / Math.PI; // Recebe um ângulo em radianos e retorna o mesmo ângulo em graus.

const buyBeer = (name, objHref, textures, price) => {
  // Recebe o nome, o link, as texturas e o preço do produto e adiciona ao carrinho.
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
  // Calcula o preço total dos produtos no carrinho.
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  let total = 0;
  cart.forEach((item) => {
    total += Number(item.price);
  });

  document.getElementById("totalPrice").innerHTML = `${total}`;
};
