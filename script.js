const query = `
SELECT DISTINCT ?item ?itemLabel ?image ?subsidiaries WHERE {
  {
    SELECT ?item WHERE { ?item (wdt:P31/wdt:P279*) wd:Q43229. }
  }
  ?item (wdt:P127|^wdt:P199|^wdt:P1830|^wdt:P355)+ wd:Q695087 .
  OPTIONAL { ?item wdt:P154 ?image . }
  OPTIONAL { 
    ?item wdt:P1830 ?subsidiariesObj .
    ?subsidiariesObj rdfs:label ?subsidiaries.
    FILTER(LANG(?subsidiaries) = "en").
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
`;

const width = window.innerWidth;
const height = window.innerHeight;

function extract_nodes(orig) {
  let data = orig.slice();

  data.forEach(elem => elem["name"] = elem["itemLabel"]["value"]);
  data = data.filter(elem => elem["subsidiaries"] === undefined);
  data.forEach(elem => elem["id"] = elem["item"]["value"].replace("http://www.wikidata.org/entity/", ""));

  return data;
}

function extract_links(orig) {
  let data = orig.slice();

}

function draw(data) {
  console.log(data);
  data = {
    "nodes": data["nodes"],
    "links": [
      {"source": 2, "target": 1, "weight": 1},
      {"source": 0, "target": 2, "weight": 3}
    ]
  };

  const svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height);

  const force = d3.layout.force()
    .gravity(.05)
    .distance(100)
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
