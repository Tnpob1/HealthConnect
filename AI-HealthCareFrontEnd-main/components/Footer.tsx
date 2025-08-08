import React from 'react'

export default function Footer() {
  return (<>
    <div>
        <footer className="bg-white text-gray-500 text-center py-3 shadow-inner" 
        style={{backgroundColor: 'rgba(240, 244, 248, 0.8)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)',
      }}>
        &copy; {new Date().getFullYear()} HealthConnect. All rights reserved.
      </footer></div></>
  )
}
