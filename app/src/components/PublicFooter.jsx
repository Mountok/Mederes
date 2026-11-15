import { Link } from 'react-router-dom'

import { operator } from '../operator.js'

export default function PublicFooter() {
  return <footer className="public-footer">
    <div className="public-footer-inner">
      <div className="public-footer-identity"><strong>Al-Qalam</strong><span>{operator.name} · ИНН {operator.inn}</span></div>
      <nav aria-label="Документы и контакты"><Link to="/legal">Контакты и реквизиты</Link><Link to="/privacy">Обработка данных</Link><Link to="/terms">Условия использования</Link><Link to="/consent">Согласие на обработку данных</Link></nav>
      <div className="public-footer-contacts"><a href={operator.phoneHref}>{operator.phone}</a><a href={`mailto:${operator.email}`}>{operator.email}</a></div>
    </div>
  </footer>
}
