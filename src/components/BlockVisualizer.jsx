import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const SHARD_COUNT = 6
const WIDTH = 1200
const HEIGHT = 800
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2
const RADIUS = 300 // Radius of the circle on which shards are placed
const SHARD_RADIUS = 80
const MIN_ACCOUNT_RADIUS = 5
const MAX_ACCOUNT_RADIUS = 20
const PARTICLE_RADIUS = 3

// Color configuration
const BASE_HUE = 240 // Base blue hue
const HUE_RANGE = 60 // How much to vary the hue

function BlockVisualizer({ data }) {
  const svgRef = useRef(null)
  
  useEffect(() => {
    if (!svgRef.current || !data) return

    const svg = d3.select(svgRef.current)
      .attr('width', WIDTH)
      .attr('height', HEIGHT)

    // Clear previous content
    svg.selectAll('*').remove()

    // Create container for transactions
    const transactionGroup = svg.append('g')
      .attr('transform', `translate(${CENTER_X}, ${CENTER_Y})`)

    // Create shard containers
    const shardGroup = svg.append('g')
      .attr('transform', `translate(${CENTER_X}, ${CENTER_Y})`)

    // Calculate shard positions
    const shardPositions = Array.from({ length: SHARD_COUNT }, (_, i) => {
      const angle = (i * 2 * Math.PI) / SHARD_COUNT - Math.PI / 2 // Start from top
      return {
        x: Math.cos(angle) * RADIUS,
        y: Math.sin(angle) * RADIUS,
        id: i,
        angle
      }
    })

    // Store account positions for transaction animations
    const accountPositions = new Map()

    // Collect all unique accounts across all shards
    const allAccounts = new Set()
    data.forEach(shardData => {
      Array.from(shardData.accounts.keys()).forEach(account => allAccounts.add(account))
    })

    // Create color scale for accounts
    const colorScale = d3.scaleOrdinal()
      .domain(Array.from(allAccounts))
      .range(d3.range(HUE_RANGE).map(h => 
        d3.hsl(BASE_HUE + h, 0.8, 0.6).toString()
      ))

    // Draw shard containers
    const shards = shardGroup.selectAll('.shard-group')
      .data(shardPositions)
      .enter()
      .append('g')
      .attr('class', 'shard-group')
      .attr('transform', d => `translate(${d.x}, ${d.y})`)

    // Add shard circles
    shards.append('circle')
      .attr('class', 'shard')
      .attr('r', SHARD_RADIUS)
      .attr('fill', 'none')
      .attr('stroke', '#646cff')
      .attr('stroke-width', 2)

    // Add shard labels
    shards.append('text')
      .attr('class', 'shard-label')
      .attr('y', -SHARD_RADIUS - 20)
      .attr('text-anchor', 'middle')
      .text(d => `Shard ${d.id}`)
      .attr('fill', '#888')

    // Process and add account circles for each shard
    shardPositions.forEach((shardPos, shardId) => {
      const shardData = data[shardId]
      if (!shardData) return

      // Calculate positions for account circles within shard
      const accountPositionsInShard = Array.from(shardData.accounts.entries()).map(([accountId, count], i) => {
        const angleStep = (2 * Math.PI) / shardData.accounts.size
        const innerRadius = SHARD_RADIUS * 0.6 // Leave some padding inside shard
        const angle = i * angleStep
        const x = Math.cos(angle) * innerRadius
        const y = Math.sin(angle) * innerRadius
        
        // Store global position for this account
        accountPositions.set(accountId, {
          x: x + shardPos.x,
          y: y + shardPos.y,
          shardId
        })

        return {
          id: accountId,
          receipts: count?.receipts || 0,
          transactions: count?.transactions || 0,
          x,
          y,
          radius: d3.scaleLinear()
            .domain([0, Math.max(1, ...Array.from(shardData.accounts.values(), v => (v?.receipts || 0)))]
            )
            .range([MIN_ACCOUNT_RADIUS, MAX_ACCOUNT_RADIUS])(count?.receipts || 0)
        }
      })

      // Add account circles
      const shard = shardGroup.select(`.shard-group:nth-child(${shardId + 1})`)
      shard.selectAll('.account')
        .data(accountPositionsInShard)
        .enter()
        .append('circle')
        .attr('class', 'account')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('r', d => d.radius)
        .attr('fill', d => colorScale(d.id))
        .attr('opacity', 0.6)
        .append('title') // Add tooltip
        .text(d => `${d.id}\nReceipts: ${d.receipts}\nTransactions: ${d.transactions}`)
    })

    // Draw and animate transactions
    data.forEach((shardData, shardId) => {
      shardData.transactions.forEach(tx => {
        const source = accountPositions.get(tx.signerId)
        const target = accountPositions.get(tx.receiverId)
        
        if (source && target) {
          // Create path for transaction
          const path = transactionGroup.append('path')
            .attr('class', 'transaction')
            .attr('d', `M${source.x},${source.y} L${target.x},${target.y}`)
            .attr('stroke', colorScale(tx.signerId))
            .attr('stroke-width', 1)
            .attr('opacity', 0.2)
            .attr('fill', 'none')

          // Animate particle along the path
          const particle = transactionGroup.append('circle')
            .attr('class', 'particle')
            .attr('r', PARTICLE_RADIUS)
            .attr('fill', colorScale(tx.signerId))

          // Animation
          function animateParticle() {
            particle
              .attr('opacity', 1)
              .transition()
              .duration(1000)
              .ease(d3.easeLinear)
              .attrTween('transform', () => {
                const l = path.node().getTotalLength()
                return t => {
                  const p = path.node().getPointAtLength(t * l)
                  return `translate(${p.x},${p.y})`
                }
              })
              .on('end', () => {
                particle.remove()
                path.remove()
              })
          }

          animateParticle()
        }
      })
    })

  }, [data])

  return (
    <div className="block-visualizer">
      <svg ref={svgRef}></svg>
    </div>
  )
}

export default BlockVisualizer 