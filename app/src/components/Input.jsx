function Input({ label, caption, error, as = 'input', className = '', ...props }) {
  const Component = as

  return (
    <label className="input-stack">
      {label ? <span className="label">{label}</span> : null}
      <Component
        className={[
          as === 'textarea' ? 'textarea-field' : as === 'select' ? 'select-field' : 'input-field',
          className,
        ]
          .join(' ')
          .trim()}
        {...props}
      />
      {error ? <span className="input-error">{error}</span> : null}
      {caption ? <span className="input-caption">{caption}</span> : null}
    </label>
  )
}

export default Input
