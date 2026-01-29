import React, { useState, useEffect, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollToTopButtonProps {
  scrollContainerRef: RefObject<HTMLElement>;
}

const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({ scrollContainerRef }) => {
  const [isVisible, setIsVisible] = useState(false);

  // Función para obtener la posición de desplazamiento actual
  const getScrollPosition = (container: HTMLElement | null): number => {
    if (container) {
      return container.scrollTop;
    }
    // Fallback para desplazamiento de ventana (común en móvil)
    return window.scrollY || document.documentElement.scrollTop;
  };

  // Función para manejar el desplazamiento
  const toggleVisibility = () => {
    const scrollPosition = getScrollPosition(scrollContainerRef.current);
    if (scrollPosition > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  // Función para volver al inicio
  const scrollToTop = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } else {
      // Fallback para desplazamiento de ventana
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    
    // 1. Intentar escuchar el contenedor interno
    if (container) {
      container.addEventListener('scroll', toggleVisibility);
      toggleVisibility();
      
      return () => {
        container.removeEventListener('scroll', toggleVisibility);
      };
    } 
    
    // 2. Si no hay contenedor (o si el desplazamiento es a nivel de ventana), usar window
    window.addEventListener('scroll', toggleVisibility);
    toggleVisibility();
    
    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, [scrollContainerRef]);

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 transition-opacity duration-300",
      isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
    )}>
      <Button
        onClick={scrollToTop}
        size="icon"
        className="rounded-full shadow-lg bg-procarni-primary hover:bg-procarni-primary/90 h-12 w-12"
        aria-label="Volver arriba"
      >
        <ArrowUp className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default ScrollToTopButton;