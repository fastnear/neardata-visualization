import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

const SHARD_COUNT = 6
const WIDTH = 1200
const HEIGHT = 830
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2
const RADIUS = 300 // Radius of the circle on which shards are placed
const SHARD_RADIUS = 80
const MIN_ACCOUNT_RADIUS = 5
const MAX_ACCOUNT_RADIUS = 20
const PARTICLE_RADIUS = 3
const TRANSITION_DURATION = 500

// Visual configuration for transactions and receipts
const TRANSACTION_COLOR = '#646cff'
const RECEIPT_COLOR = '#ff6464'
const PATH_OPACITY = 0.2
const ANIMATION_DURATION = 1000

// Function to generate consistent angle for an account ID
function getAccountAngle(accountId) {
  // Simple hash function
  let hash = 0
  for (let i = 0; i < accountId.length; i++) {
    hash = ((hash << 5) - hash) + accountId.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  // Normalize to [0, 2π]
  return (Math.abs(hash) % 1000) / 1000 * 2 * Math.PI
}

// Function to generate consistent color for an account ID
function getAccountColor(accountId) {
  // Use similar hash function but for color
  let hash = 0
  for (let i = 0; i < accountId.length; i++) {
    hash = ((hash << 5) - hash) + accountId.charCodeAt(i)
    hash = hash & hash
  }
  // Generate HSL color with consistent hue
  const hue = BASE_HUE + (Math.abs(hash) % HUE_RANGE)
  return d3.hsl(hue, 0.8, 0.6).toString()
}

// Color configuration
const BASE_HUE = 240 // Base blue hue
const HUE_RANGE = 60 // How much to vary the hue

function BlockVisualizer({ data: blockData }) {
  const svgRef = useRef(null)
  const prevGroupRef = useRef(null)
  const prevAccountPositionsRef = useRef(new Map())
  
  useEffect(() => {
    if (!svgRef.current || !blockData) return

    const data = Array.isArray(blockData) ? blockData : blockData.shardData
    if (!data) return

    const svg = d3.select(svgRef.current)
      .attr('width', WIDTH)
      .attr('height', HEIGHT)

    // If there's a previous visualization, start fading it out
    if (prevGroupRef.current) {
      d3.select(prevGroupRef.current)
        .transition()
        .duration(TRANSITION_DURATION)
        .style('opacity', 0)
        .remove()
    }

    // Create a map of all accounts in the current block
    const currentAccounts = new Set()
    data.forEach(shardData => {
      Array.from(shardData.accounts.keys()).forEach(account => currentAccounts.add(account))
    })

    // Clean up positions for accounts that no longer exist
    for (const [accountId] of prevAccountPositionsRef.current) {
      if (!currentAccounts.has(accountId)) {
        prevAccountPositionsRef.current.delete(accountId)
      }
    }

    // Create new container for this block's visualization
    const blockGroup = svg.append('g')
      .style('opacity', 0)

    // Create container for transactions
    const transactionGroup = blockGroup.append('g')
      .attr('transform', `translate(${CENTER_X}, ${CENTER_Y})`)

    // Create shard containers
    const shardGroup = blockGroup.append('g')
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
      .attr('dy', '0.35em') // Vertically center text
      .attr('y', d => {
        const isTop = d.id === 0
        const isBottom = d.id === 3
        return isTop ? -SHARD_RADIUS - 20 : isBottom ? SHARD_RADIUS + 20 : 0
      })
      .attr('x', d => {
        const isLeft = d.id === 1 || d.id === 2
        const isRight = d.id === 4 || d.id === 5
        return isLeft ? -SHARD_RADIUS - 20 : isRight ? SHARD_RADIUS + 20 : 0
      })
      .attr('text-anchor', d => {
        const isLeft = d.id === 1 || d.id === 2
        const isRight = d.id === 4 || d.id === 5
        return isLeft ? 'end' : isRight ? 'start' : 'middle'
      })
      .text(d => `Shard ${d.id}`)
      .attr('fill', '#888')

    // Process and add account circles for each shard
    shardPositions.forEach((shardPos, shardId) => {
      const shardData = data[shardId]
      if (!shardData) return

      // Get existing accounts in this shard
      const accountsInShard = Array.from(shardData.accounts.keys())

      // Calculate positions for account circles within shard
      const accountPositionsInShard = accountsInShard.map(accountId => {
        const count = shardData.accounts.get(accountId)
        const innerRadius = SHARD_RADIUS * 0.6 // Leave some padding inside shard
        const angle = getAccountAngle(accountId)
        const x = Math.cos(angle) * innerRadius
        const y = Math.sin(angle) * innerRadius
        
        // Store global position for this account
        accountPositions.set(accountId, {
          x: x + shardPos.x,
          y: y + shardPos.y,
          shardId,
          angle
        })

        return {
          id: accountId,
          receipts: count?.receipts || 0,
          transactions: count?.transactions || 0,
          x,
          y,
          radius: d3.scaleLinear()
            .domain([0, Math.max(1, ...Array.from(shardData.accounts.values(), v => (v?.receipts || 0)))])
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
        .attr('fill', d => getAccountColor(d.id))
        .attr('opacity', 0.6)
        .append('title')
        .text(d => `${d.id}\nReceipts: ${d.receipts}\nTransactions: ${d.transactions}`)
    })

    // Store current positions for next update
    prevAccountPositionsRef.current = accountPositions

    // Helper function to animate path and particle
    function animateTransfer(source, target, color, group, isReceipt = false) {
      // Create path
      const path = group.append('path')
        .attr('class', isReceipt ? 'receipt' : 'transaction')
        .attr('d', `M${source.x},${source.y} L${target.x},${target.y}`)
        .attr('stroke', color)
        .attr('stroke-width', 1)
        .attr('opacity', 0)
        .attr('fill', 'none')
        .transition()
        .duration(500)
        .attr('opacity', PATH_OPACITY)
        .transition()
        .delay(2000)
        .duration(1000)
        .attr('opacity', 0)
        .remove()

      // Animate particle
      const particle = group.append('circle')
        .attr('class', isReceipt ? 'receipt-particle' : 'particle')
        .attr('r', PARTICLE_RADIUS)
        .attr('fill', color)

      particle
        .attr('opacity', 1)
        .transition()
        .duration(ANIMATION_DURATION)
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
        })
    }

    // Draw and animate transactions
    data.forEach((shardData, shardId) => {
      shardData.transactions.forEach(tx => {
        const source = accountPositions.get(tx.signerId)
        const target = accountPositions.get(tx.receiverId)
        
        if (source && target) {
          animateTransfer(source, target, TRANSACTION_COLOR, transactionGroup)
        }
      })

      // Draw and animate receipts
      shardData.receipts.forEach(receipt => {
        const source = accountPositions.get(receipt.predecessorId)
        const target = accountPositions.get(receipt.receiverId)
        
        if (source && target) {
          animateTransfer(source, target, RECEIPT_COLOR, transactionGroup, true)
        }
      })
    })

    // Fade in the new visualization
    blockGroup
      .transition()
      .duration(TRANSITION_DURATION)
      .style('opacity', 1)

    // Store this group as the previous one for next update
    prevGroupRef.current = blockGroup.node()

  }, [blockData])

  return (
    <div className="block-visualizer">
      <svg ref={svgRef}></svg>
      <div className="attribution">
        Powered by <a href="https://fastnear.com" target="_blank" rel="noopener noreferrer">FastNear</a>
      </div>
    </div>
  )
}

export default BlockVisualizer 