import React from 'react';

class UserMenu extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className="navbar-item has-dropdown is-hoverable">
        <span className="navbar-link">
          {this.props.username}
        </span>
        <div className="navbar-dropdown is-boxed">
          <button type="button" className="user-menu-logout" onClick={this.props.logout}>
            Logout
          </button>
        </div>
      </div>
    );
  }
}

export default UserMenu;
