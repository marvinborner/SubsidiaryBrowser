const debug = true;

const PARENT = "Q7414"; // Q695087
const query = `
SELECT DISTINCT ?item ?itemLabel ?parent ?subsidiaries WHERE {
  {
    SELECT ?item WHERE { ?item wdt:P127+ wd:${PARENT} }
  }
  OPTIONAL { 
    ?item (wdt:P127|wdt:P361|wdt:P749) ?parentObj .
    ?parentObj rdfs:label ?parent .
    FILTER(LANG(?parent) = "en") .
  }
  OPTIONAL { 
    ?item wdt:P1830 ?subsidiariesObj .
    ?subsidiariesObj rdfs:label ?subsidiaries .
    FILTER(LANG(?subsidiaries) = "en") .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`;

let nodes = [];

function extract_nodes(orig) {
  let data = orig.slice();

  // Clean up
  data.forEach(elem => {
    elem["name"] = elem["itemLabel"]["value"];
    elem["parent"] = elem["parent"]["value"];
    elem["subsidiary"] = elem["subsidiaries"] ? elem["subsidiaries"]["value"] : false;
    delete elem["itemLabel"];
    delete elem["item"];
    delete elem["subsidiaries"];
  });

  // Add subsidiaries
  data.forEach(elem => {
    if (elem["subsidiary"] !== false) {
      data.push({"name": elem["subsidiary"], "parent": elem["name"], "subsidiary": false});
    }
  });

  nodes = data; // NOT WORKING CORRECTLY => SOLUTION: Extra nodes array with subsidiaries array and unique names?
  return data;
}

function extract_links() {
  let links = [];
  console.log(JSON.parse(JSON.stringify(nodes)));

  // Normal
  nodes.forEach(elem => {
    if (nodes.findIndex(node => node["name"] === elem["parent"]) === -1)
      nodes.push({"name": elem["parent"], "parent": elem["name"], "subsidiary": false});

    links.push(
      {
        "source": nodes.findIndex(node => node["name"] === elem["parent"]),
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

fetch(!debug ? "https://query.wikidata.org/sparql?query=" + query : "out.json", {
  headers: new Headers({'Accept': 'application/sparql-results+json'})
}).then(async response => (await response.json())["results"]["bindings"])
  .then(data => [extract_nodes(data), extract_links(data)])
  .then(extracted => draw({"nodes": extracted[0], "links": extracted[1]}));
