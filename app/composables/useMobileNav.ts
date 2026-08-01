export const useMobileNav = () => {
    const isOpen = useState('mobileNavOpen', () => false)

    const toggle = () => {
        isOpen.value = !isOpen.value
    }

    const close = () => {
        isOpen.value = false
    }

    return { isOpen, toggle, close }
}
