import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navigation() {
  const location = useLocation();

  return (
    <nav className="navigation">
      <div className="nav-container">
        <ul className="nav-links">
          {/* Misafir Chat linki kaldırıldı - gereksiz */}
        </ul>
      </div>
    </nav>
  );
}

export default Navigation; 