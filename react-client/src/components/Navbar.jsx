import React from 'react';
import UserMenu from './AuthUserMenu/UserMenu.jsx';

class Navbar extends React.Component {
  render() {
    const authentication = this.props.loggedIn ? (
      <UserMenu
        logout={this.props.logout}
        username={this.props.username} />
    ) : null;

    return (
      <nav className="navbar is-transparent">
        <div className="navbar-brand">
          <h1 id="logo">FoodFight with Friends</h1>
        </div>

        <div className="navbar-end">
          <div className="navbar-item">
            <div className="field is-grouped">
              <p className="control">
                <a className="bd-tw-button button" data-social-network="Twitter" data-social-action="tweet" data-social-target="http://localhost:4000" target="_blank" href="https://twitter.com/intent/tweet?text=Let's get ready to Food Fight!">
                  <span className="icon">
                    <i className="fab fa-twitter"></i>
                  </span>
                  <span>
                    Tweet
                  </span>
                </a>
              </p>
              {authentication}
            </div>
          </div>
        </div>
      </nav >
    );
  }
}

export default Navbar;
