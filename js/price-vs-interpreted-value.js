import {
  extent,
  scaleLinear,
  select,
  brushX,
  axisBottom,
  axisLeft,
  format,
} from "https://cdn.skypack.dev/d3@7";
import debounce from "https://cdn.skypack.dev/lodash.debounce";

export default class PriceVsInterpretedValue {
  /**
   * @param {HTMLElement} el - The container DIV element
   * @param {Object[]} data
   * @param {number} data[].price
   * @param {number} data[].scores
   * @param {boolean} data[].sold
   * @param {PriceVsInterpretedValue~onSelectionChange} [onSelectionChange] - The callback when the brush selection is changed
   */
  /**
   * @callback PriceVsInterpretedValue~onSelectionChange
   * @param {?Object} selection
   * @param {number} selection.min
   * @param {number} selection.max
   */
  constructor({ el, data, onSelectionChange = () => {} }) {
    this.el = el;
    this.data = data;
    this.onSelectionChange = onSelectionChange;
    this.processData();
  }

  processData() {
    const accessor = {
      x: (d) => d.price,
      y: (d) => d.scores,
      sold: (d) => d.sold,
    };
    this.xTitle = "Price";
    this.yTitle = "Scores";
    this.xFormat = format(",d");
    this.filteredData = this.data.filter(accessor.sold).map((d) => ({
      x: accessor.x(d),
      y: accessor.y(d),
    }));
    this.xExtent = extent(this.filteredData, (d) => d.x);
    this.yExtent = extent(this.filteredData, (d) => d.y);
    this.initVis();
  }

  initVis() {
    this.selection = null;

    this.debouncedResizeVis = debounce(this.resizeVis.bind(this), 100);
    this.debouncedBrushed = debounce(this.brushed.bind(this), 25);

    this.margin = {
      top: 8,
      right: 32,
      bottom: 36,
      left: 44,
    };
    this.height = 400;
    this.radius = 2;

    this.x = scaleLinear().domain(this.xExtent).nice();
    this.y = scaleLinear()
      .domain(this.yExtent)
      .range([this.height - this.margin.bottom, this.margin.top])
      .nice();
    this.brush = brushX().on("start brush end", this.debouncedBrushed);

    this.container = select(this.el)
      .append("div")
      .attr("class", "price-vs-interpreted-value")
      .style("height", `${this.height}px`);
    this.canvas = this.container.append("canvas");
    this.svg = this.container.append("svg");

    this.gX = this.svg.append("g").attr("class", "axis__g axis__g--x");
    this.gY = this.svg.append("g").attr("class", "axis__g axis__g--y");
    this.gBrush = this.svg.append("g").attr("class", "brush__g");

    const style = getComputedStyle(this.container.node());
    this.color = {
      default: style.getPropertyValue("--color-dot-default"),
      highlighted: style.getPropertyValue("--color-dot-highlighted"),
    };

    window.addEventListener("resize", this.debouncedResizeVis);
    this.resizeVis();
    this.wrangleData();
  }

  resizeVis() {
    this.width = this.el.clientWidth;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas
      .attr("width", this.width * this.dpr)
      .attr("height", this.height * this.dpr);
    this.svg.attr("viewBox", [0, 0, this.width, this.height]);

    this.ctx = this.canvas.node().getContext("2d");
    this.ctx.scale(this.dpr, this.dpr);

    this.x.range([this.margin.left, this.width - this.margin.right]);
    this.brush.extent([
      [this.margin.left, this.margin.top],
      [this.width - this.margin.right, this.height - this.margin.bottom],
    ]);

    this.gBrush.call(this.brush);

    this.renderXAxis();
    this.renderYAxis();

    if (this.displayedData) {
      this.renderDots();
    }

    if (this.selection) {
      this.gBrush.call(this.brush.move, this.selection.map(this.x));
    }
  }

  brushed({ selection, type }) {
    if (selection) {
      this.selection = selection.map(this.x.invert);
      if (type === "end") {
        this.onSelectionChange({
          min: this.selection[0],
          max: this.selection[1],
        });
      }
    } else {
      this.selection = null;
      if (type === "end") {
        this.onSelectionChange(null);
      }
    }
    this.wrangleData();
  }

  wrangleData() {
    if (this.selection) {
      const [x0, x1] = this.selection;
      this.displayedData = {
        default: [],
        highlighted: [],
      };
      this.filteredData.forEach((d) => {
        if (x0 <= d.x && d.x <= x1) {
          this.displayedData.highlighted.push(
            Object.assign(
              {
                color: this.color.highlighted,
              },
              d
            )
          );
        } else {
          this.displayedData.default.push(
            Object.assign(
              {
                color: this.color.default,
              },
              d
            )
          );
        }
      });
    } else {
      this.displayedData = {
        default: this.filteredData.map((d) =>
          Object.assign(
            {
              color: this.color.default,
            },
            d
          )
        ),
        highlighted: [],
      };
    }
    this.renderDots();
  }

  renderXAxis() {
    this.gX
      .attr("transform", `translate(0,${this.height - this.margin.bottom})`)
      .call(
        axisBottom(this.x).ticks(
          (this.width - this.margin.left - this.margin.right) / 80
        )
      )
      .attr("font-family", null)
      .attr("font-size", null)
      .call((g) =>
        g
          .selectAll(".axis__title")
          .data([this.xTitle])
          .join("text")
          .attr("class", "axis__title")
          .attr("fill", "currentColor")
          .attr("text-anchor", "middle")
          .attr(
            "transform",
            `translate(${
              this.margin.left +
              (this.width - this.margin.left - this.margin.right) / 2
            },${this.margin.bottom - 4})`
          )
          .text((d) => d)
      );
  }

  renderYAxis() {
    this.gY
      .attr("transform", `translate(${this.margin.left},0)`)
      .call(
        axisLeft(this.y).ticks(
          (this.height - this.margin.top - this.margin.bottom) / 60
        )
      )
      .attr("font-family", null)
      .attr("font-size", null)
      .call((g) =>
        g
          .selectAll(".axis__title")
          .data([this.yTitle])
          .join("text")
          .attr("class", "axis__title")
          .attr("fill", "currentColor")
          .attr("dy", "0.71em")
          .attr("text-anchor", "middle")
          .attr(
            "transform",
            `rotate(-90)translate(${-(
              this.margin.top +
              (this.height - this.margin.top - this.margin.bottom) / 2
            )},${-this.margin.left + 4})`
          )
          .text((d) => d)
      );
  }

  renderDots() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.beginPath();
    this.displayedData.default.forEach((d) => {
      this.ctx.moveTo(this.x(d.x), this.y(d.y));
      this.ctx.arc(this.x(d.x), this.y(d.y), this.radius, 0, Math.PI * 2);
    });
    this.ctx.closePath();
    this.ctx.fillStyle = this.color.default;
    this.ctx.fill();
    this.ctx.beginPath();
    this.displayedData.highlighted.forEach((d) => {
      this.ctx.moveTo(this.x(d.x), this.y(d.y));
      this.ctx.arc(this.x(d.x), this.y(d.y), this.radius, 0, Math.PI * 2);
    });
    this.ctx.closePath();
    this.ctx.fillStyle = this.color.highlighted;
    this.ctx.fill();
  }

  destroyVis() {
    select(this.el).selectAll("*").remove();
    window.removeEventListener("resize", this.debouncedResizeVis);
  }
}
