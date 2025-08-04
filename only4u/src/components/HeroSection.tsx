

// Hero Section Component
export default function HeroSection() {
  return (
    <div className="relative bg-cover bg-center h-[60vh] md:h-[80vh] flex items-center" style={{ backgroundImage: "url('/hero.jpg')" }}>
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-4" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.5)'}}>
                Discover Your Style
            </h1>
            <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.5)'}}>
                Fresh looks for every moment. Explore our latest collection and find your new favorite outfit.
            </p>
            <a href="#" className="bg-white text-black font-bold py-3 px-8 rounded-full text-lg hover:bg-gray-200 transition-all duration-300 transform hover:scale-105">
                Shop New Arrivals
            </a>
        </div>
    </div>
);
}