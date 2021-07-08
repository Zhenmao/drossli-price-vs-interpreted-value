import PriceVsInterpretedValue from "./price-vs-interpreted-value.js";

fetch("fiverdata.json")
  .then((res) => res.json())
  .then((data) => {
    const onSelectionChange = (selection) => {
      console.log(selection);
    };

    new PriceVsInterpretedValue({
      el: document.querySelector("#price-vs-interpreted-value-original"),
      data: data,
      onSelectionChange,
    });

    new PriceVsInterpretedValue({
      el: document.querySelector("#price-vs-interpreted-value-reduced"),
      data: data.filter((d, i) => i % 10 === 0),
      onSelectionChange,
    });
  });
