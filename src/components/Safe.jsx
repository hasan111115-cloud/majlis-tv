import { Component } from 'react';

/* حاجز أخطاء: أي خلل في قسم واحد لا يُسقط بقية الواجهة */
export default class Safe extends Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err) {
    console.error('[مجلس]', err);
  }
  componentDidUpdate(prev) {
    if (this.state.err && prev.resetKey !== this.props.resetKey) this.setState({ err: null });
  }
  render() {
    if (this.state.err) {
      return (
        <div className="safe-fallback" role="alert">
          <p>{this.props.label || 'حدث خطأ في هذا القسم'}</p>
          <button className="btn ghost sm" data-nav onClick={() => this.setState({ err: null })}>إعادة المحاولة</button>
        </div>
      );
    }
    return this.props.children;
  }
}
