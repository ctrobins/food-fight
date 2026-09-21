import React from 'react';
import CombatantsContainer from './CombatantsContainer.jsx';
import { withRouter } from 'react-router-dom';
import api from '../../api';

class CreateRoom extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      query: '',
      roomID: null,
      roomName: '',
      zipCode: '',

      zipValid: false,
      error: false,
      serverError: '',

      roomLink: ''
    };
  }

  createRoom() {
    if (this.props.loggedIn === false ||
      this.state.roomName.length === 0 ||
      !this.state.zipValid ||
      this.props.combatants.length === 0) {
      this.setState({
        error: true,
        serverError: '',
      });
    } else {
      api.post('/api/save', {
        roomName: this.state.roomName,
        zip: this.state.zipCode,
        members: this.props.combatants,
      })
        .then((res) => {
          const roomInfo = res.data;
          this.sendRoomEmail(roomInfo, this.props.combatants);
          this.setState({
            roomLink: roomInfo.uniqueid,
            serverError: '',
          }, () => {
            this.props.history.push(`/rooms/${roomInfo.uniqueid}`);
          });
        })
        .catch((err) => {
          const data = err.response && err.response.data;
          let serverError = 'Could not create the room.';
          if (data && data.missing && data.missing.length) {
            serverError = `These emails do not have accounts yet: ${data.missing.join(', ')}. Invite them to sign up first.`;
          } else if (data && data.error) {
            serverError = data.error;
          }
          this.setState({
            error: true,
            serverError,
          });
        });
    }
  }

  sendRoomEmail(roomInfo, members) {
    members.forEach(email => {
      api.post('/api/roomEmail', {
        email: email,
        roomInfo: roomInfo,
      });
    });
  }

  // createUniqueID() {
  //   this.setState({
  //     roomID: uniqueString(),
  //   });
  // }

  updateQuery(e) {
    this.setState({
      query: e.target.value,
    });
  }

  updateRoomName(e) {
    this.setState({
      roomName: e.target.value,
    });
  }

  updateZip(e) {
    if ((/(^\d{5}$)|(^\d{5}-\d{4}$)/).test(String(e.target.value))) {
      this.setState({
        zipCode: e.target.value,
        zipValid: true
      });
    } else {
      this.setState({
        zipCode: e.target.value,
        zipValid: false
      });
    }
  }

  render() {
    var uniqueURL = this.state.roomID ?
      `https://food-fight-greenfield.herokuapp.com/rooms/${this.state.roomID}`
      : '';

    // Validate ZIP Field
    let isZipValid1 = () => {
      if (this.state.zipCode.length === 0) {
        return { className: 'input is-large is-half' };
      } else if (this.state.zipValid) {
        return { className: 'input is-success is-large is-half' };
      } else {
        return { className: 'input is-danger is-large is-half' };
      }
    };

    // Error creating room
    const createRoomError = () => {
      if (!this.props.loggedIn) {
        return (
          <section className="section login-error" style={{ color: 'white' }}>
            <div className="container">
              <h2 className="subtitle">
                Please login to create a room.
              </h2>
            </div>
          </section>
        )
      } else {
        return this.state.error ? (
          <section className="section login-error" style={{ color: 'white' }}>
            <div className="container">
              <h2 className="subtitle">
                {this.state.serverError || 'You must have a name, the zip must be valid and the arena must have combatants.'}
              </h2>
            </div>
          </section>
        ) : null;
      }
    };

    return (
      <div>
        <div>
          <p className="title">
            Create Your Arena
          </p>
          {createRoomError()}
          <div className="columns">
            <div className="column is-three-quarters">
              <div className="field">
                <label className="label">Name</label>
                <p className="control is-expanded">
                  <input
                    className="input is-large"
                    type="text"
                    placeholder="Arena name..."
                    value={this.state.roomName}
                    onChange={this.updateRoomName.bind(this)} />
                </p>
              </div>
            </div>
            <div className="column">
              <div className="field">
                <label className="label">Region</label>
                <p className="control is-expanded">
                  <input
                    type="text"
                    pattern="[0-9]{5}"
                    title="Five digit zip code"
                    value={this.state.zipCode}
                    onChange={this.updateZip.bind(this)}
                    {...isZipValid1()}
                    placeholder="Zip Code"
                  />
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* <button onClick={this.createUniqueID.bind(this)} className="button is-normal is-info">
            Create a Unique URL
          </button>
          {uniqueURL} */}
        <div className="is-divider" />
        <CombatantsContainer
          combatants={this.props.combatants} />
        <div id="create-room-footer">
          <div>
            <div className="is-divider" />
            <button
              id="fight-button"
              onClick={this.createRoom.bind(this)}
              className="button is-primary is-large is-fullwidth">
              Fight!
              </button>
          </div>
        </div >
      </div >
    );
  }
}

export default withRouter(CreateRoom);
