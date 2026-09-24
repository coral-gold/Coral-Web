import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useSiteContent } from '../context/SiteContentContext';
import { handleLogoError } from '../utils/image';

export default function PublicLayout({ children }) {
  const { logoUrl, settings } = useSiteContent();
  return (
    <div className="section-public">
      <header className="site-header">
        <div className="container">
          <Link className="logo" to="/">
            <img className="logo-img" src={logoUrl} alt="Coral Gold" onError={handleLogoError} />
          </Link>
          <nav>
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/about">About</NavLink>
            <NavLink to="/catalog">Catalogue</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            {settings.wholesalerEnabled && (
              <Link to="/wholesaler/login" className="btn-login">Wholesaler Login</Link>
            )}
          </nav>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Coral Gold. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
