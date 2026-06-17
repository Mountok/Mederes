function Button({
  children,
  type = 'button',
  variant = 'primary',
  className = '',
  fullWidth = false,
  ...props
}) {
  const classes = ['button', `button-${variant}`]

  if (fullWidth) {
    classes.push('button-full')
  }

  if (className) {
    classes.push(className)
  }

  return (
    <button type={type} className={classes.join(' ')} {...props}>
      {children}
    </button>
  )
}

export default Button
