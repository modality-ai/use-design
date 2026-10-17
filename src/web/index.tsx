import { createRoot } from 'react-dom/client'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { Colors } from './components/Colors'
import { Typography } from './components/Typography'
import { Buttons } from './components/Buttons'
import { Cards } from './components/Cards'
import { Forms } from './components/Forms'
import { Spacing } from './components/Spacing'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { Footer } from './components/Footer'

function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Colors />
        <Typography />
        <Buttons />
        <Cards />
        <Forms />
        <Spacing />
      </main>
      <ThemeSwitcher />
      <Footer />
    </>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<App />)
}
