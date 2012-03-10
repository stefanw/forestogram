(function() {
  var BubbleChart, root,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __indexOf = Array.prototype.indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  BubbleChart = (function() {

    function BubbleChart(data, centroids) {
      this.move_towards_kind = __bind(this.move_towards_kind, this);
      this.display_by_kind = __bind(this.display_by_kind, this);
      this.move_to_country = __bind(this.move_to_country, this);
      this.display_by_country = __bind(this.display_by_country, this);
      this.update = __bind(this.update, this);
      this.update_year = __bind(this.update_year, this);
      this.update_view = __bind(this.update_view, this);
      this.start = __bind(this.start, this);
      this.create_vis = __bind(this.create_vis, this);
      this.create_nodes = __bind(this.create_nodes, this);
      this.get_stats = __bind(this.get_stats, this);
      var angle, max_amount, offset, r;
      this.data = data;
      this.centroids = centroids;
      this.width = $('#map').width();
      this.height = $('#map').height();
      this.year = 2000;
      this.blacklist = ['MNE', 'SRB'];
      this.center = {
        x: this.width / 2,
        y: this.height / 2
      };
      offset = Math.PI * 2 / 3 * 1.75;
      angle = Math.PI * 2 / 3;
      r = Math.min(this.width, this.height) / 50;
      this.kind_centers = {
        forest: {
          x: this.center.x + Math.cos(offset + angle) * r,
          y: this.center.y + Math.sin(offset + angle) * r
        },
        agriculture: {
          x: this.center.x + Math.cos(offset + angle * 2) * r,
          y: this.center.y + Math.sin(offset + angle * 2) * r
        },
        other: {
          x: this.center.x + Math.cos(offset + angle * 3) * r,
          y: this.center.y + Math.sin(offset + angle * 3) * r
        }
      };
      this.kindColors = {
        forest: '#3a7558',
        agriculture: '#DB9F2B',
        other: '#9b0909'
      };
      this.kinds = {
        forest: "Forest Area",
        agriculture: "Agriculture Area",
        other: "other area"
      };
      this.layout_gravity = -0.01;
      this.damper = 1;
      this.vis = null;
      this.nodes = [];
      this.force = null;
      this.circles = null;
      this.initial = true;
      this.earthLandArea = 148940000;
      this.view_type = 'country';
      max_amount = 16376870;
      this.radius_scale = d3.scale.sqrt().domain([0, max_amount]).range([1, 40]);
      this.create_nodes();
      this.create_vis();
    }

    BubbleChart.prototype.get_stats = function(d, v) {
      var perc, perc2;
      perc = Math.round(v / d.totalArea * 100, 2);
      perc2 = Math.round(v / this.earthLandArea * 100 * 100) / 100;
      return "" + perc + "% of " + d.name + ", " + perc2 + "% of Earth";
    };

    BubbleChart.prototype.create_nodes = function() {
      var area, data, i, key, kind, kind_name, percent, val, xy, year, _ref, _ref2, _ref3;
      _ref = this.data;
      for (key in _ref) {
        val = _ref[key];
        if (val.type !== 'COUNTRY') continue;
        if (__indexOf.call(this.blacklist, key) >= 0) continue;
        if (!(m.layers.regions.pathsById[key] != null)) continue;
        data = {
          agriculture: {},
          other: {},
          forest: {}
        };
        area = parseFloat(val.area);
        _ref2 = val.forest;
        for (year in _ref2) {
          percent = _ref2[year];
          year = parseInt(year);
          percent = parseFloat(percent);
          data.forest[year] = percent / 100 * area;
          data.agriculture[year] = parseFloat(val.agriculture[year]) / 100 * area;
          data.other[year] = (100 - (percent + parseFloat(val.agriculture[year]))) / 100 * area;
        }
        xy = this.centroids[key];
        xy = m.lonlat2xy([xy.lon, xy.lat]);
        i = 0;
        _ref3 = this.kinds;
        for (kind in _ref3) {
          kind_name = _ref3[kind];
          this.nodes.push({
            id: "" + key + "-" + kind,
            totalArea: area,
            kind: kind,
            country: key,
            name: val.name,
            kindName: kind_name,
            group: i,
            values: data[kind],
            x: xy[0],
            y: xy[1],
            countryX: xy[0],
            countryY: xy[1]
          });
          i += 1;
        }
      }
      this.nodesByKind = d3.nest().key(function(d) {
        return d.kind;
      }).entries(this.nodes);
      return this.nodesByCountry = d3.nest().key(function(d) {
        return d.country;
      }).entries(this.nodes);
    };

    BubbleChart.prototype.create_vis = function() {
      var me;
      me = this;
      this.vis = d3.select("#map svg").attr("id", "svg_vis");
      return this.countries = this.vis.append("g").selectAll('g').data(this.nodesByCountry).enter().append('g').attr('class', 'country');
    };

    BubbleChart.prototype.start = function() {
      return this.force = d3.layout.force().nodes(this.nodes).size([this.width, this.height]);
    };

    BubbleChart.prototype.update_view = function(view_type) {
      this.view_type = view_type;
      return this.update();
    };

    BubbleChart.prototype.update_year = function(year) {
      this.year = year;
      return this.update();
    };

    BubbleChart.prototype.update = function() {
      return this['display_by_' + this.view_type]();
    };

    BubbleChart.prototype.display_by_country = function() {
      var arc, me, titles;
      me = this;
      this.force.stop();
      m.layers.regions.paths.forEach(function(d) {
        return d.svgPath.attr('opacity', 1);
      });
      this.pie = d3.layout.pie().value(function(d) {
        return d.values[me.year];
      }).sort(function(a, b) {
        return a.group - b.group;
      });
      this.areas = this.countries.selectAll('path').data(function(d) {
        return me.pie(d.values);
      }).enter().append('path').attr("fill", function(d) {
        return me.kindColors[d.data.kind];
      }).attr("stroke-width", 0).attr("stroke", "#fff").attr("id", function(d) {
        return "bubble_" + d.data.kind + "_" + d.data.id;
      }).attr("class", function(d) {
        return "part " + d.data.kind;
      });
      titles = this.areas.append('title');
      titles.text(function(d) {
        return ("" + d.data.name + ":  " + d.data.kindName + "\n") + me.get_stats(d.data, d.data.values[me.year]);
      });
      this.areas = this.vis.selectAll('.part');
      arc = d3.svg.arc().innerRadius(0);
      if (this.initial) {
        arc = arc.outerRadius(0);
      } else {
        arc = arc.outerRadius(function(d) {
          return me.radius_scale(d.data.totalArea);
        });
      }
      if (this.initial) {
        this.areas.attr('d', function(d) {
          return arc(d);
        }).attr("transform", function(d) {
          return "translate(" + d.data.x + "," + d.data.y + ")";
        }).transition().duration(1000).attrTween('d', function(d) {
          var i;
          i = d3.interpolate(0, me.radius_scale(d.data.totalArea));
          return function(t) {
            return arc.outerRadius(i(t))(d);
          };
        });
      } else {
        this.areas.transition().duration(1000).attrTween("transform", function(d) {
          var i;
          i = d3.interpolate({
            x: d.data.x,
            y: d.data.y
          }, {
            x: d.data.countryX,
            y: d.data.countryY
          });
          return function(t) {
            var txy;
            txy = i(t);
            d.data.x = txy.x;
            d.data.y = txy.y;
            return "translate(" + txy.x + "," + txy.y + ")";
          };
        }).attrTween('d', function(d) {
          var i;
          i = d3.interpolate({
            startAngle: 0,
            endAngle: Math.PI * 2
          }, {
            startAngle: d.startAngle,
            endAngle: d.endAngle
          });
          return function(t) {
            var an;
            an = i(t);
            return arc.startAngle(an.startAngle).endAngle(an.endAngle)(d);
          };
        });
      }
      return this.initial = false;
    };

    BubbleChart.prototype.move_to_country = function(alpha) {
      var _this = this;
      return function(d) {
        d = d.data;
        d.x = d.x + (d.countryX - d.x) * _this.damper * alpha;
        return d.y = d.y + (d.countryY - d.y) * _this.damper * alpha;
      };
    };

    BubbleChart.prototype.display_by_kind = function() {
      var arc, me,
        _this = this;
      if (this.timeout) window.clearTimeout(this.timeout);
      me = this;
      m.layers.regions.paths.forEach(function(d) {
        return d.svgPath.attr('opacity', 0.4);
      });
      arc = d3.svg.arc().innerRadius(0).outerRadius(function(d) {
        return me.radius_scale(d.data.values[me.year]);
      }).startAngle(0).endAngle(Math.PI * 2);
      this.areas.attr('d', function(d) {
        return arc(d);
      });
      this.force.gravity(this.layout_gravity).charge(function(d) {
        return -Math.pow(me.radius_scale(d.values[me.year]), 2.0) * 2.0;
      }).friction(0.7).on("tick", function(e) {
        return _this.areas.each(_this.move_towards_kind(e.alpha)).attr("transform", function(d) {
          return "translate(" + d.data.x + "," + d.data.y + ")";
        });
      });
      return this.force.start();
    };

    BubbleChart.prototype.move_towards_kind = function(alpha) {
      var _this = this;
      return function(d) {
        var target;
        d = d.data;
        target = _this.kind_centers[d.kind];
        d.x = d.x + (target.x - d.x) * (_this.damper + 0.02) * alpha * 1.1;
        return d.y = d.y + (target.y - d.y) * (_this.damper + 0.02) * alpha * 1.1;
      };
    };

    return BubbleChart;

  })();

  root = typeof exports !== "undefined" && exports !== null ? exports : this;

  $(function() {
    var centroids, chart, render_vis,
      _this = this;
    chart = null;
    centroids = null;
    render_vis = function(data) {
      chart = new BubbleChart(data, centroids);
      chart.start();
      return chart.update();
    };
    root.toggle_view = function(view_type) {
      return chart.update_view(view_type);
    };
    root.change_year = function(year) {
      return chart.update_year(year);
    };
    return $.getJSON('data/centroids.json', function(c) {
      centroids = c;
      return d3.json('data/forest.json', render_vis);
    });
  });

}).call(this);
