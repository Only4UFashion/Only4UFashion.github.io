import { Instagram, Facebook, Twitter, Share2 } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About & Newsletter */}
          <div className="md:col-span-2">
            <h3 className="text-xl font-bold mb-4">Join Our Newsletter</h3>
            <p className="text-gray-400 mb-4">Get exclusive access to new arrivals, sales, and more.</p>
            <form className="flex">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full px-4 py-2 rounded-l-md text-gray-800 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-6 py-2 rounded-r-md transition-colors"
              >
                Subscribe
              </button>
            </form>
          </div>
          {/* Customer Service */}
          <div>
            <h3 className="text-xl font-bold mb-4">Customer Service</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white">Contact Us</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Shipping & Returns</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">FAQ</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Size Guide</a></li>
            </ul>
          </div>
          {/* Quick Links */}
          <div>
            <h3 className="text-xl font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white">About Us</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Shop All</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">My Account</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-700 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">&copy; {new Date().getFullYear()} Only4U Fashion. All Rights Reserved.</p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <a href="#" className="text-gray-400 hover:text-white"><Instagram size={20}/></a>
            <a href="#" className="text-gray-400 hover:text-white"><Facebook size={20}/></a>
            <a href="#" className="text-gray-400 hover:text-white"><Twitter size={20}/></a>
            <a href="#" className="text-gray-400 hover:text-white"><Share2 size={20}/></a>
          </div>
        </div>
      </div>
    </footer>
  );
}