import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, FlaskRound as Flask } from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  const toggleMenu = () => setIsOpen(!isOpen);
  
  const navLinkClass = ({ isActive }: { isActive: boolean }) => 
    `px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
      isActive 
        ? 'bg-blue-700 text-white' 
        : 'text-gray-700 hover:bg-blue-500 hover:text-white'
    }`;

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <NavLink to="/" className="flex items-center">
              <Flask className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-800">Flask-React</span>
            </NavLink>
          </div>
          
          {/* Desktop menu */}
          <div className="hidden md:flex md:items-center md:space-x-2">
            <NavLink to="/" className={navLinkClass} end>Home</NavLink>
            <NavLink to="/todos" className={navLinkClass}>Todos</NavLink>
            <NavLink to="/about" className={navLinkClass}>About</NavLink>
            <NavLink to="/scorm-test" className={navLinkClass}>SCORM Test</NavLink>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-500 hover:bg-gray-100 focus:outline-none"
              aria-expanded={isOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      <div className={`md:hidden ${isOpen ? 'block' : 'hidden'}`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <NavLink 
            to="/" 
            className={({isActive}) => 
              `block px-3 py-2 rounded-md text-base font-medium ${
                isActive ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-blue-500 hover:text-white'
              }`
            }
            onClick={toggleMenu}
            end
          >
            Home
          </NavLink>
          <NavLink 
            to="/todos" 
            className={({isActive}) => 
              `block px-3 py-2 rounded-md text-base font-medium ${
                isActive ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-blue-500 hover:text-white'
              }`
            }
            onClick={toggleMenu}
          >
            Todos
          </NavLink>
          <NavLink 
            to="/about" 
            className={({isActive}) => 
              `block px-3 py-2 rounded-md text-base font-medium ${
                isActive ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-blue-500 hover:text-white'
              }`
            }
            onClick={toggleMenu}
          >
            About
          </NavLink>
          <NavLink 
            to="/scorm-test" 
            className={({isActive}) => 
              `block px-3 py-2 rounded-md text-base font-medium ${
                isActive ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-blue-500 hover:text-white'
              }`
            }
            onClick={toggleMenu}
          >
            SCORM Test
          </NavLink>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;