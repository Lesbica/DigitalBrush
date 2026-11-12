import { Link } from 'react-router-dom';
import styles from './NotFound.module.css';

export default function NotFound() {
    return (
        <main className={styles.page}>
            <p className={styles.code}>404</p>
            <h1>Page not found</h1>
            <p className={styles.text}>The page you are looking for does not exist or has been moved.</p>
            <Link className={styles.link} to="/">Go to the home page</Link>
        </main>
    );
}
