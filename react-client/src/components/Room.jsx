import React from 'react';
import io from 'socket.io-client';
import RestaurantList from './RestaurantList.jsx';
import CurrentSelection from './CurrentSelection.jsx';
import api from '../api';

const toChatMessage = (entry) => {
  if (typeof entry === 'string') {
    return { name: '', message: entry };
  }
  if (entry && typeof entry === 'object' && (typeof entry.message === 'string' || typeof entry.name === 'string')) {
    return {
      name: entry.name || '',
      message: typeof entry.message === 'string' ? entry.message : '',
    };
  }
  return null;
};

class Room extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      message: '',
      messages: [],
      members: [],
      zipcode: undefined,
      currentSelection: undefined,
      currentSelectionName: undefined,
      isNominating: true,
      votes: [],
      loggedInUsername: props.username || null,
      roomName: '',
      hasVoted: false,
      voteError: '',
    };
    this.roomID = this.props.match.params.roomID;

    this.nominateRestaurant = this.nominateRestaurant.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.voteApprove = this.voteApprove.bind(this);
    this.voteVeto = this.voteVeto.bind(this);

    this.socket = io();
    this.socket.emit('join', this.roomID);

    this.socket.on('chat', (payload) => {
      if (!payload || payload.roomID !== this.roomID) {
        return;
      }
      const entry = toChatMessage(payload.message != null ? payload.message : payload);
      if (!entry) {
        return;
      }
      this.setState((state) => ({
        messages: [...state.messages, entry],
      }));
    });
    this.socket.on('vote', (roomID) => {
      if (roomID === this.roomID) {
        this.getVotes();
      }
    });

    this.socket.on('veto', (roomID) => {
      if (roomID === this.roomID) {
        this.setState({
          isNominating: true,
          currentSelection: undefined,
          hasVoted: false,
          voteError: '',
        });
        this.getVotes();
      }
    });

    this.socket.on('nominate', (nominee) => {
      if (nominee.roomID === this.roomID) {
        const known = this.state.votes.find((entry) => (
          entry.id === nominee.restaurant.dbId || entry.name === nominee.restaurant.name
        ));
        this.setState({
          currentSelection: nominee.restaurant,
          isNominating: false,
          hasVoted: known ? Boolean(known.votedByMe) : false,
          voteError: '',
        });
      }
    });

    this.socket.on('join', (roomID) => {
      if (roomID === this.roomID) {
        if (this.state.currentSelection) {
          this.socket.emit('nominate', { restaurant: this.state.currentSelection, roomID: this.roomID });
        }
      }
    });
  }

  componentDidMount() {
    this.getMessages();
    this.getRoomInfo();
    this.getVotes();
  }

  componentWillUnmount() {
    this.socket.disconnect();
  }

  restaurantIdFor(selection) {
    if (!selection) {
      return null;
    }
    if (selection.dbId) {
      return selection.dbId;
    }
    const match = this.state.votes.find((restaurant) => restaurant.name === selection.name);
    return match ? match.id : null;
  }

  getMessages() {
    api.get(`/api/messages/${this.roomID}`).then((res) => {
      this.setState({
        messages: (res.data || []).map(toChatMessage).filter(Boolean),
      });
    });
  }

  getRoomInfo() {
    api.get(`/api/rooms/${this.roomID}`).then((res) => {
      const roomMembers = res.data || [];
      if (!roomMembers.length || !roomMembers[0].rooms || !roomMembers[0].rooms.length) {
        return;
      }
      this.setState({
        members: roomMembers,
        zipcode: roomMembers[0].rooms[0].zipcode,
        roomName: roomMembers[0].rooms[0].name,
      });
    });
  }

  getVotes() {
    api.get(`/api/votes/${this.roomID}`).then((res) => {
      const restaurants = res.data || [];
      this.setState((state) => {
        const currentName = state.currentSelection && state.currentSelection.name;
        const current = restaurants.find((restaurant) => restaurant.name === currentName);
        const next = {
          votes: restaurants,
        };
        if (current) {
          next.hasVoted = Boolean(current.votedByMe);
          if (!state.currentSelection.dbId) {
            next.currentSelection = { ...state.currentSelection, dbId: current.id };
          }
        }
        if (restaurants.length && !state.currentSelection) {
          const active = restaurants.find((restaurant) => !restaurant.vetoed);
          if (active) {
            next.currentSelectionName = active.name;
          }
        }
        return next;
      });
    });
  }

  nominateRestaurant(restaurant, reloading = false) {
    if (!this.state.isNominating) {
      return;
    }
    const known = this.state.votes.find((entry) => entry.name === restaurant.name);
    const withKnownId = known ? { ...restaurant, dbId: known.id } : restaurant;
    this.setState({
      currentSelection: withKnownId,
      isNominating: false,
      hasVoted: known ? Boolean(known.votedByMe) : false,
      voteError: '',
    });
    if (reloading) {
      return;
    }
    api.post('/api/nominate', {
      name: restaurant.name,
      roomID: this.roomID,
    }).then((res) => {
      const saved = { ...restaurant, dbId: res.data.id };
      this.setState({ currentSelection: saved });
      this.socket.emit('nominate', {
        restaurant: saved,
        roomID: this.roomID,
      });
      if (!known || !known.votedByMe) {
        this.voteApprove(saved);
      }
    }).catch((err) => {
      const data = err.response && err.response.data;
      this.setState({
        voteError: (data && data.error) || 'Could not nominate that restaurant.',
        isNominating: true,
        currentSelection: undefined,
      });
    });
  }

  sendMessage() {
    const messageObj = {
      message: {
        name: this.state.name,
        message: this.state.message,
      },
      roomID: this.roomID,
    };
    api.post('/api/messages', messageObj).then(() => {
      this.socket.emit('chat', messageObj);
    });
  }

  updateName(e) {
    this.setState({
      name: e.target.value,
    });
  }

  updateMessage(e) {
    this.setState({
      message: e.target.value,
    });
  }

  voteApprove(restaurant) {
    const selection = restaurant && restaurant.name ? restaurant : this.state.currentSelection;
    const restaurantId = this.restaurantIdFor(selection);
    if (!selection || !restaurantId) {
      return;
    }
    if (this.state.hasVoted) {
      return;
    }
    api.post('/api/votes', {
      restaurantId,
      roomID: this.roomID,
    }).then(() => {
      this.setState({
        hasVoted: true,
        voteError: '',
      });
      this.socket.emit('vote', { roomID: this.roomID });
    }).catch((err) => {
      const status = err.response && err.response.status;
      const data = err.response && err.response.data;
      this.setState({
        hasVoted: status === 409,
        voteError: (data && data.error) || 'Could not record your vote.',
      });
    });
  }

  voteVeto() {
    const selection = this.state.currentSelection;
    const restaurantId = this.restaurantIdFor(selection);
    if (!selection || !restaurantId) {
      return;
    }
    this.setState({
      isNominating: true,
      currentSelection: undefined,
      hasVoted: false,
    });
    api.post('/api/vetoes', {
      restaurantId,
      roomID: this.roomID,
    }).then(() => {
      this.socket.emit('veto', { roomID: this.roomID });
    }).catch((err) => {
      const data = err.response && err.response.data;
      this.setState({
        voteError: (data && data.error) || 'Could not veto that restaurant.',
      });
    });
  }

  render() {
    const restaurantList = this.state.zipcode ? (
      <RestaurantList zipcode={this.state.zipcode} nominate={this.nominateRestaurant} currentName={this.state.currentSelectionName} />
    ) : (
      ''
    );
    const currentSelection = (this.state.currentSelection && !this.state.isNominating) ? (
      <CurrentSelection restaurant={this.state.currentSelection} />
    ) : (
      <div>Please nominate a restaurant</div>
    );
    const canVote = Boolean(this.state.currentSelection) && !this.state.isNominating && !this.state.hasVoted;
    return (
      <div>
        <section className="hero is-primary">
          <div className="hero-body">
            <div className="container">
              <h1 className="title">
                Welcome to Room {this.state.roomName}
              </h1>
              <h2 className="subtitle">
                <div>
                  Fighters: {this.state.members.map((user) => <span key={user.email}>{user.email} </span>)}
                </div>
                <div>Zipcode: {this.state.zipcode}</div>
              </h2>
            </div>
          </div>
        </section>
        <div className="columns room-layout">
            <div className="column is-6">
                <article className="notification">
                  <div id="yelp-list">
                    <p className="title">Local Resturants</p>
                    {restaurantList}
                  </div>
                </article>
            </div>
            <div className="column">
                <article className="notification">
                  <div id="current-resturant">
                    <p className="title">Current Selection</p>
                    {currentSelection}
                    <button onClick={() => this.voteApprove()} disabled={!canVote} className="button is-success">
                      Approve
                    </button>
                    <button onClick={this.voteVeto} disabled={!this.state.currentSelection || this.state.isNominating} className="button is-danger">
                      Veto
                    </button>
                    {this.state.voteError ? (
                      <p className="help is-danger">{this.state.voteError}</p>
                    ) : null}
                    <div>
                      <h3>Scoreboard</h3>
                      <table className="table is-striped is-bordered is-fullwidth">
                        <thead>
                          <tr>
                            <th>Resturant</th>
                            <th>Votes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...this.state.votes]
                            .sort((a, b) => b.votes - a.votes)
                            .map((restaurant) => (
                              <tr key={restaurant.id} className={(restaurant.name === this.state.currentSelection?.name) ? 'is-selected' : ''}>
                                <td>{restaurant.name}</td>
                                <td>{restaurant.votes}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </article>
                <article className="notification">
                  <div id="chat">
                    <h4 className="is-size-4">Live Chat</h4>
                    <div>
                      Name{' '}
                      <input
                        type="text"
                        className="input"
                        value={this.state.name}
                        onChange={this.updateName.bind(this)}
                      />
                    </div>
                    <span>
                      Message{' '}
                      <input
                        type="text"
                        className="input"
                        value={this.state.message}
                        onChange={this.updateMessage.bind(this)}
                      />
                    </span>
                    <button
                      onClick={this.sendMessage.bind(this)}
                      className="button is-outlined is-primary is-medium send-message"
                    >
                      Send
                    </button>
                    <div className="chat-messages">
                      {this.state.messages.map((message, index) => (
                        <p key={`${message.name}-${index}`}>
                          <strong>{message.name}:</strong> {message.message}
                        </p>
                      ))}
                    </div>
                  </div>
                </article>
            </div>
        </div>
      </div>
    );
  }
}
export default Room;
