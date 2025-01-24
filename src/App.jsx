import { useState, useEffect } from 'react'
import './App.css'
import BlockVisualizer from './components/BlockVisualizer'
import { fetchLatestFinalBlock, waitForNextBlock } from './services/blockService'

function App() {
  const [blockData, setBlockData] = useState(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentHeight, setCurrentHeight] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchLatestFinalBlock()
      console.log('Initial block:', data)
      setBlockData(data)
      if (data?.block?.block?.header?.height) {
        const height = parseInt(data.block.block.header.height)
        console.log('Setting initial height:', height)
        setCurrentHeight(height)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    console.log('Streaming state:', { isStreaming, currentHeight })
    if (!isStreaming || !currentHeight) return

    let isCancelled = false

    const streamBlocks = async () => {
      try {
        while (!isCancelled) {
          const nextHeight = currentHeight + 1
          console.log('Fetching block:', nextHeight)
          const nextBlock = await waitForNextBlock(nextHeight)
          
          if (!isCancelled && nextBlock?.block?.block?.header?.height) {
            console.log('Got new block:', nextBlock)
            setBlockData(nextBlock)
            setCurrentHeight(parseInt(nextBlock.block.block.header.height))
          }
        }
      } catch (error) {
        console.error('Error streaming blocks:', error)
        setIsStreaming(false)
      }
    }

    streamBlocks()

    return () => {
      isCancelled = true
    }
  }, [isStreaming, currentHeight])

  return (
    <div className="App">
      <h1>NEAR Protocol Block Visualizer</h1>
      <button 
        onClick={() => setIsStreaming(prev => !prev)}
        className={isStreaming ? 'active' : ''}
      >
        {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
      </button>
      <div className="visualizer-container">
        <BlockVisualizer data={blockData} />
      </div>
    </div>
  )
}

export default App
