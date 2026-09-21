import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route } from 'react-router-dom';

import Navbar from './components/Navbar.jsx';
import api from './api';

import 'bulma/css/bulma.css';
import 'animate.css/animate.css';
import './styles/main.scss';

const MainView = React.lazy(() => import('./components/MainView.jsx'));
const SignupPage = React.lazy(() => import('./components/AuthUserMenu/SignupPage.jsx'));
const Room = React.lazy(() => import('./components/Room.jsx'));

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loggedIn: false,
      loggedInUsername: '',
      loginError: false,
      subscribeError: false,
      googleEnabled: false,
      googleSignInMessage: null,
      needsZip: false,
      zipDraft: '',
      zipError: false,
      searchedUsers: [],
    };
  }

  componentDidMount() {
    const params = new URLSearchParams(window.location.search);
    const googleSignIn = params.get('googleSignIn');
    if (googleSignIn === 'unavailable') {
      this.setState({
        googleSignInMessage: 'Google sign-in is not configured on this server. Use email and password, or add GOOGLE_AUTH_CLIENT_ID and GOOGLE_AUTH_CLIENT_SECRET to .env.',
      });
    } else if (googleSignIn === 'failed') {
      this.setState({
        googleSignInMessage: 'Google sign-in failed. Please try again or use email and password.',
      });
    }
    if (googleSignIn || params.get('setZip') === '1') {
      params.delete('googleSignIn');
      params.delete('setZip');
      const next = params.toString();
      window.history.replaceState({}, '', next ? `/?${next}` : '/');
    }

    this.refreshSession().catch(() => {});

    api.get('/api/auth/providers')
      .then((res) => {
        this.setState({ googleEnabled: Boolean(res.data.google) });
      });
  }

  refreshSession() {
    return api.get('/checklogin')
      .then((res) => {
        if (res.data.user) {
          this.setState({
            loggedIn: true,
            loggedInUsername: res.data.user.email,
            loginError: false,
            subscribeError: false,
            needsZip: res.data.user.zipcode == null,
          });
        } else {
          this.setState({
            loggedIn: false,
            loggedInUsername: '',
            needsZip: false,
          });
        }
      });
  }

  searchUsers(query) {
    api.post('/searchUsers', { query })
      .then((res) => {
        this.setState({
          searchedUsers: res.data,
        });
      });
  }

  subscribe(email, password, zip) {
    api.post('/subscribe', {
      email,
      password,
      zip,
    })
      .then(() => this.refreshSession())
      .catch(() => {
        this.setState({
          subscribeError: true,
        });
      });
  }

  login(email, password) {
    api.post('/login', {
      email,
      password,
    })
      .then(() => this.refreshSession())
      .catch(() => {
        this.setState({
          loginError: true,
        });
      });
  }

  logout() {
    api.post('/logout')
      .finally(() => this.refreshSession());
  }

  updateZipDraft(e) {
    this.setState({
      zipDraft: e.target.value,
      zipError: false,
    });
  }

  saveZip() {
    if (!(/^\d{5}$/).test(this.state.zipDraft)) {
      this.setState({ zipError: true });
      return;
    }
    api.post('/api/profile/zip', { zip: this.state.zipDraft })
      .then(() => this.refreshSession())
      .catch(() => this.setState({ zipError: true }));
  }

  render() {
    const zipPrompt = this.state.loggedIn && this.state.needsZip ? (
      <section className="section">
        <div className="container">
          <div className="notification">
            <p className="title is-5">Add your home zip code</p>
            <p>Google sign-in does not include a zip code. Save one so your profile is complete.</p>
            <div className="field has-addons" style={{ marginTop: '12px' }}>
              <div className="control">
                <input
                  className={this.state.zipError ? 'input is-danger' : 'input'}
                  placeholder="78701"
                  value={this.state.zipDraft}
                  onChange={this.updateZipDraft.bind(this)}
                />
              </div>
              <div className="control">
                <button className="button is-primary" onClick={this.saveZip.bind(this)}>
                  Save zip
                </button>
              </div>
            </div>
            {this.state.zipError ? (
              <p className="help is-danger">Enter a 5-digit zip code.</p>
            ) : null}
          </div>
        </div>
      </section>
    ) : null;

    return (
      <BrowserRouter>
        <div>
          <Navbar
            login={this.login.bind(this)}
            logout={this.logout.bind(this)}
            subscribe={this.subscribe.bind(this)}
            loggedIn={this.state.loggedIn}
            username={this.state.loggedInUsername}
            error={this.state.loginError}
            subscribeError={this.state.subscribeError}
            googleEnabled={this.state.googleEnabled}
            googleSignInMessage={this.state.googleSignInMessage}
          />
          {zipPrompt}
          <Suspense fallback={<div className="section">Loading...</div>}>
            <Route exact path="/" render={
              (props) => <MainView
                searchUsers={this.searchUsers.bind(this)}
                searchedUsers={this.state.searchedUsers}
                loggedIn={this.state.loggedIn}
                loggedInUser={this.state.loggedInUsername}
                {...props} />} />
            <Route path="/signup" render={
              (props) => <SignupPage
                subscribe={this.subscribe.bind(this)}
                subscribeError={this.state.subscribeError}
                googleEnabled={this.state.googleEnabled}
                {...props} />} />
            <Route path="/rooms/:roomID" render={
              (props) => <Room username={this.state.loggedInUsername} {...props} />} />
          </Suspense>
        </div>
      </BrowserRouter>
    );
  }
}

const root = createRoot(document.getElementById('app'));
root.render(<App />);
