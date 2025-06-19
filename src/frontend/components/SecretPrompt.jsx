import React, { useState } from 'react'

const SecretPrompt = ({ onSecretSubmit }) => {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!secret.trim()) {
      setError('Please enter the secret')
      return
    }
    setError('')
    onSecretSubmit(secret)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">
          Access Required
        </h2>
        <p className="text-gray-600 mb-6 text-center">
          Please enter the secret to access the application
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter secret"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Connect
          </button>
        </form>
      </div>
    </div>
  )
}

export default SecretPrompt
