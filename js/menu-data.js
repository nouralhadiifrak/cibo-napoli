/*
 * Cibo Napoli menu, from the restaurant's menu (docs/source/menu/, November 2026). Prices in DH.
 *
 * Category: { id, name: {fr, en}, art (drawn placeholder: pizza | pasta | ravioli | lasagna | plate | dessert | drink),
 *             image (category photo, optional), options (option group asked before adding, optional), items }
 * Item:     { id, name (Italian names are the same in both languages, or {fr, en}), desc: {fr, en}, price,
 *             image (optional: "/assets/photos/<id>.webp", 600 x 600), options (overrides the category's) }
 * desc is optional (left out where the menu has none).
 * price: null = price not known yet: shown as "price soon" and cannot be ordered.
 */
(function () {
  // Asked before a fresh pasta goes in the cart (the menu shows the three shapes under each pasta page).
  const PASTA_SHAPE = {
    id: "shape",
    title: { fr: "Quelle pâte ?", en: "Which pasta?" },
    required: true,
    choices: [
      { id: "fusilli", name: "Fusilli" },
      { id: "spaghetti", name: "Spaghetti" },
      { id: "tagliatelle", name: "Tagliatelle" },
    ],
  };

  window.OPTION_GROUPS = { pastaShape: PASTA_SHAPE };

  window.MENU = [
    {
      id: "pizze",
      name: { fr: "Pizze", en: "Pizze" },
      sub: { fr: "Pizzas napolitaines", en: "Neapolitan pizzas" },
      art: "pizza",
      items: [
        { id: "bella-margarita", name: "Bella Margarita", price: 45,
          desc: { fr: "Sauce tomate, mozzarella, basilic, huile d'olive", en: "Tomato sauce, mozzarella, basil, olive oil" } },
        { id: "al-pollo", name: "Al Pollo", price: 55,
          desc: { fr: "Sauce tomate, mozzarella fior di latte, poulet grillé, champignons, basilic", en: "Tomato sauce, fior di latte mozzarella, grilled chicken, mushrooms, basil" } },
        { id: "peperoni", name: "Peperoni", price: 55,
          desc: { fr: "Sauce tomate, mozzarella, pepperoni, basilic, huile d'olive, parmesan di Valgrana", en: "Tomato sauce, mozzarella, pepperoni, basil, olive oil, Valgrana parmesan" } },
        { id: "tonno-e-cipollando", name: "Tonno e Cipollando", price: 55,
          desc: { fr: "Sauce tomate, mozzarella latte, thon, oignon, basilic", en: "Tomato sauce, mozzarella, tuna, onion, basil" } },
        { id: "capricciosa", name: "Capricciosa", price: 59,
          desc: { fr: "Crème parmesan, jambon, stracciatella, champignons, mozzarella, roquette, parmesan", en: "Parmesan cream, ham, stracciatella, mushrooms, mozzarella, rocket, parmesan" } },
        { id: "funghi", name: "Funghi", price: 59,
          desc: { fr: "Crème parmesan, mozzarella fior di latte, champignons, huile de truffe, parmesan di Valgrana", en: "Parmesan cream, fior di latte mozzarella, mushrooms, truffle oil, Valgrana parmesan" } },
        { id: "maradona", name: "Maradona", price: 60,
          desc: { fr: "Crème de courgette, mozzarella fior di latte, fromage de chèvre, oignon rouge caramélisé, noix grillées, huile d'olive extra vierge", en: "Courgette cream, fior di latte mozzarella, goat cheese, caramelised red onion, toasted walnuts, extra virgin olive oil" } },
        { id: "verdura", name: "Verdura", price: 60,
          desc: { fr: "Crème de courgette, mozzarella fior di latte, courgettes, oignons, champignons, roquette, parmesan di Valgrana", en: "Courgette cream, fior di latte mozzarella, courgettes, onions, mushrooms, rocket, Valgrana parmesan" } },
        { id: "diavola", name: "Diavola", price: 65,
          desc: { fr: "Sauce blanche, mozzarella fior di latte, poulet grillé, dinde fumée, champignons, roquette", en: "White sauce, fior di latte mozzarella, grilled chicken, smoked turkey, mushrooms, rocket" } },
        { id: "formaggi-amore", name: "Formaggi Amore", price: 65,
          desc: { fr: "Crème parmesan, mozzarella, gorgonzola, chèvre, parmesan di Valgrana", en: "Parmesan cream, mozzarella, gorgonzola, goat cheese, Valgrana parmesan" } },
        { id: "carne", name: "Carne", price: 65,
          desc: { fr: "Sauce tomate, mozzarella latte, viande hachée, champignons, basilic, oignon", en: "Tomato sauce, mozzarella, minced beef, mushrooms, basil, onion" } },
        { id: "chorizo-e-carne", name: "Chorizo e Carne", price: 69,
          desc: { fr: "Sauce tomate, mozzarella fior di latte, champignons, viande hachée, pepperoni, basilic", en: "Tomato sauce, fior di latte mozzarella, mushrooms, minced beef, pepperoni, basil" } },
        { id: "napolitaine", name: "Napolitaine", price: 69,
          desc: { fr: "Sauce tomate, anchois marinés, mozzarella, câpres, basilic, tomates cerises, parmesan di Valgrana", en: "Tomato sauce, marinated anchovies, mozzarella, capers, basil, cherry tomatoes, Valgrana parmesan" } },
        { id: "equilibrio", name: "Equilibrio", price: 75,
          desc: { fr: "Crème de courgette, mozzarella latte, gorgonzola, bresaola de bœuf, tomates confites, noix", en: "Courgette cream, mozzarella, gorgonzola, beef bresaola, confit tomatoes, walnuts" } },
        { id: "tonno-e-stracciatella", name: "Tonno e Stracciatella", price: 75,
          desc: { fr: "Crème parmesan, mozzarella latte, thon, formaggio di Napoli, mozzarella, stracciatella", en: "Parmesan cream, mozzarella, tuna, formaggio di Napoli, mozzarella, stracciatella" } },
        { id: "scusami", name: "Scusami", price: 75,
          desc: { fr: "Crème parmesan, mozzarella fior di latte, champignons, roquette, jambon de dinde, stracciatella, avocat, tomates confites, parmesan di Valgrana", en: "Parmesan cream, fior di latte mozzarella, mushrooms, rocket, turkey ham, stracciatella, avocado, confit tomatoes, Valgrana parmesan" } },
        { id: "truffe-mafia", name: "Truffe Mafia", price: 85,
          desc: { fr: "Crème de truffe, mozzarella fior di latte, champignons, roquette, tomates confites, parmesan di Valgrana", en: "Truffle cream, fior di latte mozzarella, mushrooms, rocket, confit tomatoes, Valgrana parmesan" } },
        { id: "gamberi", name: "Gamberi", price: 85,
          desc: { fr: "Crème de courgette, mozzarella fior di latte, champignons, gambas, roquette, sauce pesto", en: "Courgette cream, fior di latte mozzarella, mushrooms, king prawns, rocket, pesto sauce" } },
        { id: "marinara", name: "Marinara", price: 85,
          desc: { fr: "Sauce tomate, champignons, gambas, poulpe, moules, basilic", en: "Tomato sauce, mushrooms, king prawns, octopus, mussels, basil" } },
        { id: "pizza-cibo-napoli", name: "Cibo Napoli", price: 95,
          desc: { fr: "Crème au parmesan, mozzarella fior di latte, viande hachée, champignons, roquette, jambon de bœuf, stracciatella, parmesan, tomates confites, sauce pesto, huile d'olive extra vierge", en: "Parmesan cream, fior di latte mozzarella, minced beef, mushrooms, rocket, beef ham, stracciatella, parmesan, confit tomatoes, pesto sauce, extra virgin olive oil" } },
      ],
    },
    {
      id: "pasta-fresca",
      name: { fr: "Pasta fresca", en: "Pasta fresca" },
      sub: { fr: "Pâtes fraîches · fusilli, spaghetti ou tagliatelle", en: "Fresh pasta · fusilli, spaghetti or tagliatelle" },
      art: "pasta",
      options: "pastaShape",
      items: [
        { id: "arrabiata-fuoco", name: "Arrabiata Fuoco", price: 39,
          desc: { fr: "Tomates, piment, ail, huile d'olive, basilic frais, olives noires", en: "Tomatoes, chilli, garlic, olive oil, fresh basil, black olives" } },
        { id: "alfredo", name: "Alfredo", price: 55,
          desc: { fr: "Crème de parmesan, poulet, champignons, parmesan di Valgrana", en: "Parmesan cream, chicken, mushrooms, Valgrana parmesan" } },
        { id: "pesto-alla-genovese", name: "Pesto alla Genovese", price: 55,
          desc: { fr: "Crème pesto, huile d'olive, stracciatella, basilic", en: "Pesto cream, olive oil, stracciatella, basil" } },
        { id: "al-tonno", name: "Al Tonno", price: 58,
          desc: { fr: "Sauce tomate, basilic, thon, câpres, tomates cerises, parmesan di Valgrana", en: "Tomato sauce, basil, tuna, capers, cherry tomatoes, Valgrana parmesan" } },
        { id: "bolognaise", name: "Bolognaise", price: 59,
          desc: { fr: "Sauce bolognaise traditionnelle maison, basilic frais et copeaux de parmesan di Valgrana", en: "Traditional homemade bolognese sauce, fresh basil and Valgrana parmesan shavings" } },
        { id: "formaggi-di-campagna", name: "Formaggi di Campagna", price: 59,
          desc: { fr: "Crème de parmesan, gorgonzola, chèvre, parmigiano di Valgrana, fromage rosso", en: "Parmesan cream, gorgonzola, goat cheese, Valgrana parmigiano, rosso cheese" } },
        { id: "pesto-rosso", name: "Pesto Rosso", price: 60,
          desc: { fr: "Crème maison, basilic, tomates confites, noix", en: "Homemade cream, basil, confit tomatoes, walnuts" } },
        { id: "truffa-mafia", name: "Truffa Mafia", price: 70,
          desc: { fr: "Crème de truffe noire, champignons, copeaux de parmesan", en: "Black truffle cream, mushrooms, parmesan shavings" } },
        { id: "pesto-gambas", name: "Pesto Gambas", price: 75,
          desc: { fr: "Crème de pesto, gambas, parmesan, courgettes", en: "Pesto cream, king prawns, parmesan, courgettes" } },
      ],
    },
    {
      id: "ravioli",
      name: { fr: "Ravioli", en: "Ravioli" },
      art: "ravioli",
      items: [
        { id: "ravioli-pollo", name: "Ravioli Pollo", price: 60,
          desc: { fr: "Ricotta, poulet, parmesan crémeux di Valgrana", en: "Ricotta, chicken, creamy Valgrana parmesan" } },
        { id: "ravioli-bolognaise", name: "Ravioli Bolognaise", price: 69,
          desc: { fr: "Sauce tomate, viande hachée, ricotta, parmesan di Valgrana", en: "Tomato sauce, minced beef, ricotta, Valgrana parmesan" } },
        { id: "ravioli-al-truffo", name: "Ravioli al Truffo", price: 79,
          desc: { fr: "Champignons de Paris, crème truffe, parmigiano di Valgrana, ricotta", en: "Button mushrooms, truffle cream, Valgrana parmigiano, ricotta" } },
      ],
    },
    {
      id: "lasagna",
      name: { fr: "Lasagna", en: "Lasagna" },
      sub: { fr: "La recette de la Nonna", en: "Nonna's recipe" },
      art: "lasagna",
      items: [
        { id: "lasagne-nonna", name: "Lasagne Nonna", price: 70,
          desc: { fr: "Misto di bolognaise, recette secrète Cibo Napoli, parmigiano di Valgrana, basilic, mozzarella", en: "Bolognese mix, Cibo Napoli secret recipe, Valgrana parmigiano, basil, mozzarella" } },
      ],
    },
    {
      id: "plats",
      name: { fr: "Nos plats", en: "Our dishes" },
      sub: { fr: "Servis avec pâtes fraîches sauce maison et frites", en: "Served with fresh pasta in house sauce and fries" },
      art: "plate",
      items: [
        { id: "milanese-pollo", name: "Milanese Pollo", price: 69,
          desc: { fr: "Escalope panée croustillante (pâtes fraîches sauce maison, frites)", en: "Crispy breaded chicken escalope (fresh pasta in house sauce, fries)" } },
        { id: "emince-poulet-champignon", name: { fr: "Émincé de poulet sauce champignon", en: "Sliced chicken, mushroom sauce" }, price: 75,
          desc: { fr: "Poulet mariné, sauce champignon (pâtes fraîches sauce maison, frites)", en: "Marinated chicken, mushroom sauce (fresh pasta in house sauce, fries)" } },
      ],
    },
    {
      id: "dolci",
      name: { fr: "Dolci", en: "Dolci" },
      sub: { fr: "Desserts", en: "Desserts" },
      art: "dessert",
      items: [
        { id: "panna-cotta-fruits-rouges", name: { fr: "Panna cotta fruits rouges", en: "Red berry panna cotta" }, price: 25 },
        { id: "panna-cotta-mangue", name: { fr: "Panna cotta mangue", en: "Mango panna cotta" }, price: 25 },
        { id: "tiramisu", name: "Tiramisu", price: 30 },
        { id: "creme-brulee", name: "Crème brûlée", price: 35 },
        { id: "cheesecake", name: "Cheesecake", price: 40 },
      ],
    },
    {
      id: "bevande",
      name: { fr: "Boissons", en: "Drinks" },
      art: "drink",
      // TODO: drink prices (not on the menu).
      items: [
        { id: "coca-cola", name: "Coca-Cola", price: null },
        { id: "sprite", name: "Sprite", price: null },
        { id: "hawai", name: "Hawai", price: null },
        { id: "schweppes", name: "Schweppes", price: null },
        { id: "poms", name: "Poms", price: null },
      ],
    },
  ];
})();
