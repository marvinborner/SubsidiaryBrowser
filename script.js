const PARENT = "Q7414"; // Q695087
const query = `
SELECT DISTINCT ?item ?itemLabel ?image ?subsidiaries WHERE {
  {
    SELECT ?item WHERE { ?item (wdt:P31/wdt:P279*) wd:Q43229. }
  }
  ?item (wdt:P127|^wdt:P199|^wdt:P1830|^wdt:P355)+ wd:${PARENT} .
  OPTIONAL { ?item wdt:P154 ?image . }
  OPTIONAL { 
    ?item wdt:P1830 ?subsidiariesObj .
    ?subsidiariesObj rdfs:label ?subsidiaries.
    FILTER(LANG(?subsidiaries) = "en").
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
`;

let nodes = [];

function extract_nodes(orig) {
  let data = orig.slice();

  data.forEach(elem => elem["name"] = elem["itemLabel"]["value"]);
  data.filter(elem => elem["subsidiaries"] !== undefined).forEach(elem => {
    data.push({"name": elem["subsidiaries"]["value"], "is_subsidiary": true});
    data.push({"name": elem["name"]});
  });
  data = data.filter(elem => elem["subsidiaries"] === undefined);

  // THIS IS NOT PRETTY!
  const names = [];
  data = data.filter(elem => names.includes(elem["name"]) ? false : names.push(elem["name"]));

  data.unshift({"name": "MARS", "parent": 0});

  nodes = data;
  return data;
}

function extract_links(orig) {
  const links = [];
  let data = orig.slice();
  console.log(JSON.parse(JSON.stringify(data)));
  console.log(JSON.parse(JSON.stringify(nodes)));

  // Sub-sub
  data.filter(elem => elem["subsidiaries"] !== undefined).forEach(elem => links.push(
    {
      "source": nodes.findIndex(node => node["name"] === elem["name"]),
      "target": nodes.findIndex(node => node["name"] === elem["subsidiaries"]["value"]),
      "weight": 1
    }
  ));

  // Normal
  nodes.filter(elem => !elem["is_subsidiary"]).forEach(elem => {
    links.push(
      {
        "source": 0,
        "target": nodes.findIndex(node => node["name"] === elem["name"]),
        "weight": 1
      }
    )
  });

  console.log(links);

  return links;
}

function draw(data) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  document.getElementById("loading").remove();

  const svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(d3.behavior.zoom().on("zoom", function () {
      svg.attr("transform", "translate(" + d3.event.translate + ")" + " scale(" + d3.event.scale + ")")
    }))
    .append("g");

  const force = d3.layout.force()
    .gravity(.005)
    .distance(300)
    .charge(-100)
    .size([width, height]);

  force
    .nodes(data.nodes)
    .links(data.links)
    .start();

  const link = svg.selectAll(".link")
    .data(data.links)
    .enter().append("line")
    .attr("class", "link")
    .style("stroke-width", d => Math.sqrt(d.weight));

  const node = svg.selectAll(".node")
    .data(data.nodes)
    .enter().append("g")
    .attr("class", "node")
    .call(force.drag);

  node.append("circle")
    .attr("r", "5");

  node.append("text")
    .attr("dx", 12)
    .attr("dy", ".35em")
    .text(d => d.name);

  force.on("tick", () => {
    link.attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
  });
}

fetch("https://query.wikidata.org/sparql?query=" + query, {
  headers: new Headers({'Accept': 'application/sparql-results+json'})
}).then(async response => (await response.json())["results"]["bindings"])
  .then(data => [extract_nodes(data), extract_links(data)])
  .then(extracted => draw({"nodes": extracted[0], "links": extracted[1]}));
