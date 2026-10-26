import React from 'react';
import LoginDialog from './AuthUserMenu/LoginDialog.jsx';

class LoggedOutGate extends React.Component {
  render() {
    const googleSignInMessage = this.props.googleSignInMessage ? (
      <div className="notification is-warning login-gate-notice">
        {this.props.googleSignInMessage}
      </div>
    ) : null;

    return (
      <section className="hero is-primary login-gate">
        <div className="hero-body">
          <div className="has-text-centered">
            <h1 className="title is-3">
              You've been invited to a Food Fight. Log in to continue
            </h1>
            {googleSignInMessage}
            <LoginDialog
              label="Log in"
              buttonClassName="button is-light is-medium"
              login={this.props.login}
              error={this.props.error}
              googleEnabled={this.props.googleEnabled}
              googleSignInMessage={this.props.googleSignInMessage}
            />
          </div>
        </div>
      </section>
    );
  }
}

export default LoggedOutGate;
