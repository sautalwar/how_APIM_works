import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return React.createElement('pre', {
        style: { padding: '2rem', color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }
      }, 'RENDER ERROR:\n' + this.state.error.message + '\n\n' + this.state.error.stack)
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(ErrorBoundary, null,
    React.createElement(App)
  )
)
