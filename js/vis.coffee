
# Parts based on vallandingham.me/bubble_charts_in_d3.html

class BubbleChart
  constructor: (data, centroids) ->
    @data = data
    @centroids = centroids
    @width = $('#map').width()
    @height = $('#map').height()
    @year = 2000
    @blacklist = ['MNE', 'SRB']


    # locations the nodes will move towards
    # depending on which view is currently being
    # used
    @center = {x: @width / 2, y: @height / 2}
    offset = Math.PI * 2 / 3 * 1.75
    angle = Math.PI * 2 / 3
    r = Math.min(@width, @height) / 50
    @kind_centers = {
      forest: {x: @center.x + Math.cos(offset + angle) * r, y: @center.y + Math.sin(offset + angle) * r},
      agriculture: {x: @center.x + Math.cos(offset + angle * 2) * r, y: @center.y + Math.sin(offset + angle * 2) * r},
      other: {x: @center.x + Math.cos(offset + angle * 3) * r, y: @center.y + Math.sin(offset + angle * 3) * r},
    }

    @kindColors =
      forest: '#3a7558'
      agriculture: '#DB9F2B'
      other: '#9b0909'

    @kinds =
      forest: "Forest Area"
      agriculture: "Agriculture Area"
      other: "other area"

    # used when setting up force and
    # moving around nodes
    @layout_gravity = -0.01
    @damper = 1

    # these will be set in create_nodes and create_vis
    @vis = null
    @nodes = []
    @force = null
    @circles = null
    @initial = true
    @earthLandArea = 148940000
    @view_type = 'country'

    # use the max total_amount in the data as the max in the scale's domain
    # max_amount = d3.max(@data, (d, v) ->
    #   console.log(arguments)
    #   v.area
    # )
    max_amount = 16376870
    @radius_scale = d3.scale.sqrt().domain([0, max_amount]).range([1, 40])

    # totally hardcoded
    this.create_nodes()
    this.create_vis()

  get_stats: (d, v) =>
    perc = Math.round(v / d.totalArea * 100, 2)
    perc2 = Math.round(v / @earthLandArea * 100 * 100) / 100
    "#{perc}% of #{d.name}, #{perc2}% of Earth"

  # create node objects from original data
  # that will serve as the data behind each
  # bubble in the vis, then add each node
  # to @nodes to be used later
  create_nodes: () =>
    for key, val of @data
      if val.type != 'COUNTRY'
        continue
      if key in @blacklist
        continue
      if not m.layers.regions.pathsById[key]?
        continue
      data =
        agriculture: {}
        other: {}
        forest: {}
      area = parseFloat(val.area)
      for year, percent of val.forest
        year = parseInt(year)
        percent = parseFloat(percent)
        data.forest[year] = percent / 100 * area
        data.agriculture[year] = parseFloat(val.agriculture[year]) / 100 * area
        data.other[year] = (100 - (percent + parseFloat(val.agriculture[year]))) / 100 * area
      xy = @centroids[key]
      xy = m.lonlat2xy([xy.lon, xy.lat])
      i = 0
      for kind, kind_name of @kinds
        @nodes.push
          id: "#{key}-#{kind}"
          totalArea: area
          kind: kind
          country: key
          name: val.name
          kindName: kind_name
          group: i
          values: data[kind]
          x: xy[0]
          y: xy[1]
          countryX: xy[0]
          countryY: xy[1]
        i +=1
    @nodesByKind = d3.nest()
      .key((d) -> d.kind)
      .entries(@nodes)
    @nodesByCountry = d3.nest()
      .key((d) -> d.country)
      .entries(@nodes)

    # @nodesByCountry.forEach((d) ->
    #   d.x = d.values[0].x
    #   d.y = d.values[0].y
    # )

  # create svg at #vis and then
  # create circle representation for each node
  create_vis: () =>
    me = this
    @vis = d3.select("#map svg")
      .attr("id", "svg_vis")
    @countries = @vis.append("g")
      .selectAll('g')
      .data(@nodesByCountry)
      .enter()
        .append('g')
        .attr('class', 'country')


  # Starts up the force layout with
  # the default values
  start: () =>
    @force = d3.layout.force()
      .nodes(@nodes)
      .size([@width, @height])

  update_view: (view_type) =>
    @view_type = view_type
    @update()

  update_year: (year) =>
    @year = year
    # @areas.data((d) => @pie(d.values))
    @update()

  update: () =>
    this['display_by_' + @view_type]()

  # Sets up force layout to display
  # all nodes in one circle.
  display_by_country: () =>
    me = this
    @force.stop()
    m.layers.regions.paths.forEach((d) -> d.svgPath.attr('opacity', 1))

    @pie = d3.layout.pie().value((d) ->
      d.values[me.year]
    ).sort((a, b) -> a.group - b.group)

    @areas = @countries
      .selectAll('path')
      .data((d) -> me.pie(d.values))
      .enter()
        .append('path')
        .attr("fill", (d) -> me.kindColors[d.data.kind])
        .attr("stroke-width", 0)
        .attr("stroke", "#fff")
        .attr("id", (d) -> "bubble_#{d.data.kind}_#{d.data.id}")
        .attr("class", (d) -> "part #{d.data.kind}")
    titles = @areas.append('title')
    titles.text((d) -> "#{d.data.name}:  #{d.data.kindName}\n" + me.get_stats(d.data, d.data.values[me.year]))
    @areas = @vis.selectAll('.part')

    arc = d3.svg.arc().innerRadius(0)
    if @initial
      arc = arc.outerRadius(0)
    else
      arc = arc.outerRadius((d) -> me.radius_scale(d.data.totalArea))
        # .startAngle(0)
        # .endAngle(Math.PI * 2)

    if @initial
      @areas
        .attr('d', (d) -> arc(d))
        .attr("transform", (d) -> "translate(" + d.data.x + "," + d.data.y + ")")
        .transition()
          .duration(1000)
          .attrTween('d', (d) ->
            i = d3.interpolate(0, me.radius_scale(d.data.totalArea))
            (t) ->
              arc.outerRadius(i(t))(d)
          )
    else
      @areas
        .transition()
        .duration(1000)
        .attrTween("transform", (d) ->
          i = d3.interpolate({x: d.data.x, y: d.data.y}, {x: d.data.countryX, y: d.data.countryY})
          (t) ->
            txy = i(t)
            d.data.x = txy.x
            d.data.y = txy.y
            "translate(" + txy.x + "," + txy.y + ")"
        )
        .attrTween('d', (d) ->
          i = d3.interpolate({startAngle: 0, endAngle: Math.PI * 2},
              {startAngle: d.startAngle, endAngle: d.endAngle})
          (t) ->
            an = i(t)
            arc.startAngle(an.startAngle).endAngle(an.endAngle)(d)
        )

    @initial = false

  # Moves all circles towards their country
  move_to_country: (alpha) =>
    (d) =>
      d = d.data
      d.x = d.x + (d.countryX - d.x) * (@damper) * alpha
      d.y = d.y + (d.countryY - d.y) * (@damper) * alpha

  # sets the display of bubbles to be separated
  # into each year. Does this by calling move_towards_year
  display_by_kind: () =>
    if @timeout
      window.clearTimeout(@timeout)
    me = this
    m.layers.regions.paths.forEach((d) -> d.svgPath.attr('opacity', 0.4))
    arc = d3.svg.arc().innerRadius(0)
      .outerRadius((d) -> me.radius_scale(d.data.values[me.year]))
      .startAngle(0)
      .endAngle(Math.PI * 2)
    @areas
      .attr('d', (d) -> arc(d))
      # .transition()
      #   .duration(500)
      #   .attr('transform', (d) ->
      #     txy = me.kind_centers[d.data.kind]
      #     rxy = [Math.random() * 50, Math.random() * 50]
      #     "translate(" + (txy.x + rxy[0]) + "," + (txy.y + rxy[1]) + ")");
    @force.gravity(@layout_gravity)
      .charge((d) -> -Math.pow(me.radius_scale(d.values[me.year]), 2.0) * 2.0)
      .friction(0.7)
      .on "tick", (e) =>
        @areas.each(this.move_towards_kind(e.alpha))
          .attr("transform", (d) -> "translate(" + d.data.x + "," + d.data.y + ")");
    @force.start()
    # @timeout = window.setTimeout((=> ), 500)

  # move all circles to their associated @year_centers
  move_towards_kind: (alpha) =>
    (d) =>
      d = d.data
      target = @kind_centers[d.kind]
      d.x = d.x + (target.x - d.x) * (@damper + 0.02) * alpha * 1.1
      d.y = d.y + (target.y - d.y) * (@damper + 0.02) * alpha * 1.1


root = exports ? this

$ ->
  chart = null
  centroids = null
  render_vis = (data) ->
    chart = new BubbleChart data, centroids
    chart.start()
    chart.update()
  root.toggle_view = (view_type) =>
    chart.update_view(view_type)
  root.change_year = (year) =>
    chart.update_year(year)
  $.getJSON 'data/centroids.json', (c) ->
    centroids = c
    d3.json 'data/forest.json', render_vis
