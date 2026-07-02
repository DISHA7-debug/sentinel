import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { NODE_COLORS } from "../utils/colors";
import { Card, CardHeader } from "./ui/Card";

export default function SceneGraph({ data }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (!data?.nodes?.length) {
      svg
        .append("text")
        .attr("x", "50%")
        .attr("y", "50%")
        .attr("text-anchor", "middle")
        .attr("fill", "#6B7280")
        .attr("font-size", 12)
        .text("Awaiting scene data…");
      return;
    }

    const width = containerRef.current?.clientWidth || 320;
    const height = 200;

    const nodes = data.nodes.map((n) => ({ ...n }));
    const links = (data.edges || []).map((e) => ({
      source: e.source,
      target: e.target,
      relation: e.relation,
      distance_m: e.distance_m,
    }));

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(60))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(22));

    const linkGroup = svg.append("g").attr("class", "links");
    const nodeGroup = svg.append("g").attr("class", "nodes");
    const labelGroup = svg.append("g").attr("class", "labels");

    const link = linkGroup
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#3B4250")
      .attr("stroke-width", 1.5);

    const linkLabel = linkGroup
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("font-size", 8)
      .attr("fill", "#6B7280")
      .text((d) => (d.distance_m != null ? `${d.distance_m.toFixed(1)}m` : ""));

    const node = nodeGroup
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => (d.type === "ego" ? 12 : 8))
      .attr("fill", (d) => NODE_COLORS[d.type] || NODE_COLORS.default)
      .attr("stroke", "#0F1115")
      .attr("stroke-width", 2);

    const label = labelGroup
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", 9)
      .attr("fill", "#D1D5DB")
      .attr("dx", 14)
      .attr("dy", 4);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      linkLabel
        .attr("x", (d) => (d.source.x + d.target.x) / 2)
        .attr("y", (d) => (d.source.y + d.target.y) / 2 - 4);

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      label.attr("x", (d) => d.x).attr("y", (d) => d.y);
    });

    return () => simulation.stop();
  }, [data]);

  const edgeCount = data?.edges?.length || 0;
  const nodeCount = data?.nodes?.length || 0;

  return (
    <Card padding="p-3">
      <CardHeader
        title="Scene Graph"
        subtitle={nodeCount > 0 ? `${nodeCount} nodes · ${edgeCount} relations` : undefined}
      />
      <div ref={containerRef} className="w-full">
        <svg ref={svgRef} width="100%" height={200} />
      </div>
    </Card>
  );
}
