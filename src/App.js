import { BrowserRouter } from 'react-router-dom';
import Nav from './components/Nav/Nav';
import AppRouter from './AppRouter';
import Footer from './components/Footer/Footer';
import { CartProvider } from './components/Cart/CartContext';
import { ModalProvider } from './context/ModalContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';

function App() {
    return (
        <BrowserRouter>
            <ToastProvider>
                <AuthProvider>
                    <SocketProvider>
                        <CartProvider>
                            <ModalProvider>
                                <div className="App">
                                    <Nav />
                                    <AppRouter />
                                    <Footer />
                                </div>
                            </ModalProvider>
                        </CartProvider>
                    </SocketProvider>
                </AuthProvider>
            </ToastProvider>
        </BrowserRouter>
    );
}

export default App;
