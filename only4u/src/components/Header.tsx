"use client";

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Menu, X, Search, User, ShoppingCart } from 'lucide-react';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { data: session } = useSession();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/check-admin')
        .then((res) => res.json())
        .then((data) => {
          setIsAdmin(data.isAdmin);
        })
        .catch(() => {
          setIsAdmin(false);
        });
    } else {
      setIsAdmin(false);
    }
  }, [session]);

  const categories = [
    { name: 'Dresses', path: '/products/dress' },
    { name: 'Pants', path: '/products/pants' },
    { name: 'Shirts', path: '/products/shirt' },
    { name: 'Jackets', path: '/products/jacket' },
    { name: 'Accessories', path: '/products/accessory' },
  ];

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'New Arrivals', path: '/products/new-arrivals' },
    { name: 'Best Sellers', path: '/products/best-sellers' },
    { name: 'All Products', path: '/products' },
    { name: 'Sale', path: '/products/sale' },
  ];

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 200);
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="bg-pink-100 text-pink-800 text-center py-2 text-sm font-medium">
        Free Shipping on Orders Over $75
      </div>
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="lg:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-black"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
          <div className="flex-shrink-0">
            <Link href="/">
              <img src="/only4logo.JPG" alt="Only4U Logo" className="h-14 w-auto" />
            </Link>
          </div>
          <div className="hidden lg:flex lg:items-center lg:space-x-8">
            {navLinks.map(link => (
              <div
                key={link.name}
                className="relative"
                onMouseEnter={link.name === 'All Products' ? handleMouseEnter : undefined}
                onMouseLeave={link.name === 'All Products' ? handleMouseLeave : undefined}
              >
                <Link
                  href={link.path}
                  className="text-gray-600 hover:text-black font-medium transition-colors duration-200"
                >
                  {link.name}
                </Link>
                {link.name === 'All Products' && isDropdownOpen && (
                  <div
                    className="absolute left-0 top-full -mt-1 w-48 bg-white shadow-lg rounded-md py-2 z-10"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    {categories.map(category => (
                      <Link
                        key={category.name}
                        href={category.path}
                        className="block px-4 py-2 text-gray-600 hover:bg-gray-100 hover:text-black"
                      >
                        {category.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {session?.user && isAdmin && (
              <>
                <Link
                  href="/admin/add-product"
                  className="text-gray-600 hover:text-black font-medium transition-colors duration-200"
                >
                  Add Product
                </Link>
                <Link
                  href="/admin/dashboard"
                  className="text-gray-600 hover:text-black font-medium transition-colors duration-200"
                >
                  Edit Product
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Link href="#" className="text-gray-600 hover:text-black">
              <Search size={22} />
            </Link>
            <Link href={session?.user ? '/profile' : '/login'} className="text-gray-600 hover:text-black">
              <User size={22} />
            </Link>
            {session?.user && (
              <>
                <span className="text-gray-600 text-sm">{session.user.name}</span>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-gray-600 hover:text-black text-sm font-medium"
                >
                  Sign Out
                </button>
              </>
            )}
            <Link href="#" className="relative text-gray-600 hover:text-black">
              <ShoppingCart size={22} />
              <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                3
              </span>
            </Link>
          </div>
        </div>
      </nav>
      {isMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map(link => (
              <div key={link.name}>
                <Link
                  href={link.path}
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-black hover:bg-gray-50"
                  onClick={() => link.name === 'All Products' ? setIsDropdownOpen(false) : null}
                >
                  {link.name}
                </Link>
                {link.name === 'All Products' && (
                  <div>
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-black hover:bg-gray-50"
                    >
                      Categories {isDropdownOpen ? '▲' : '▼'}
                    </button>
                    {isDropdownOpen && (
                      <div className="pl-4 space-y-1">
                        {categories.map(category => (
                          <Link
                            key={category.name}
                            href={category.path}
                            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-black hover:bg-gray-50"
                          >
                            {category.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <Link
              href={session?.user ? '/profile' : '/login'}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-black hover:bg-gray-50"
            >
              {session?.user ? 'Profile' : 'Sign In'}
            </Link>
            {session?.user && isAdmin && (
              <>
                <Link
                  href="/admin/add-product"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-black hover:bg-gray-50"
                >
                  Add Product
                </Link>
                <Link
                  href="/admin/dashboard"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-black hover:bg-gray-50"
                >
                  Edit Product
                </Link>
              </>
            )}
            {session?.user && (
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-black hover:bg-gray-50"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}