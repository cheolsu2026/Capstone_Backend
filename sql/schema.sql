CREATE DATABASE IF NOT EXISTS puzzle13_db
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE puzzle13_db;

CREATE TABLE IF NOT EXISTS Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL
);

-- USERS
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  profile_image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- AUTH_TOKENS
CREATE TABLE auth_tokens (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- FRIEND_REQUESTS
CREATE TABLE friend_requests (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  requester_id CHAR(36) NOT NULL,
  target_id CHAR(36) NOT NULL,
  status ENUM('pending','accepted','rejected') DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (target_id) REFERENCES users(id)
);

-- FRIENDS
CREATE TABLE friends (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_a_id CHAR(36) NOT NULL,
  user_b_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_friend_pair (user_a_id, user_b_id),
  FOREIGN KEY (user_a_id) REFERENCES users(id),
  FOREIGN KEY (user_b_id) REFERENCES users(id)
);

-- ROOMS
CREATE TABLE rooms (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  host_id CHAR(36),
  code VARCHAR(10) NOT NULL UNIQUE,
  status ENUM('waiting','playing','finished') DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES users(id)
);

-- ROOM_PARTICIPANTS
CREATE TABLE room_participants (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  room_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  is_ready BOOLEAN DEFAULT FALSE,
  is_host BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_room_user (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- GAMES
CREATE TABLE games (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  room_id CHAR(36),
  user_id CHAR(36),
  mode ENUM('single','multi') NOT NULL,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- TAGS (전역 사전)
CREATE TABLE tags (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL UNIQUE
);

-- GAME_TAGS (게임별 태그 인스턴스)
CREATE TABLE game_tags (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  game_id CHAR(36) NOT NULL,
  tag_id CHAR(36) NOT NULL,
  entered_by_user_id CHAR(36),
  order_index INT CHECK (order_index BETWEEN 1 AND 4),
  UNIQUE KEY uniq_game_tag (game_id, tag_id),
  UNIQUE KEY uniq_game_order (game_id, order_index),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id),
  FOREIGN KEY (entered_by_user_id) REFERENCES users(id)
);

-- GAME_IMAGES
CREATE TABLE game_images (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  game_id CHAR(36) NOT NULL,
  image_url TEXT,
  metadata JSON,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id)
);

-- GAME_COMPLETIONS
CREATE TABLE game_completions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  game_id CHAR(36),
  user_id CHAR(36),
  image_id CHAR(36),
  clear_time_ms INT,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  winner BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (game_id) REFERENCES games(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (image_id) REFERENCES game_images(id)
);

-- PLANETS
CREATE TABLE planets (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  owner_id CHAR(36),
  title VARCHAR(100),
  decoration_data JSON,
  visit_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- PLANET_FAVORITES
CREATE TABLE planet_favorites (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  planet_id CHAR(36),
  favorited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_fav (user_id, planet_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (planet_id) REFERENCES planets(id)
);

-- PLANET_VISITS
CREATE TABLE planet_visits (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  visitor_id CHAR(36),
  planet_id CHAR(36),
  visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (visitor_id) REFERENCES users(id),
  FOREIGN KEY (planet_id) REFERENCES planets(id)
);

-- GALLERIES
CREATE TABLE galleries (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  planet_id CHAR(36),
  image_id CHAR(36),
  title VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (planet_id) REFERENCES planets(id),
  FOREIGN KEY (image_id) REFERENCES game_images(id)
);

-- GUESTBOOKS
CREATE TABLE guestbooks (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  planet_id CHAR(36),
  author_id CHAR(36),
  content TEXT,
  written_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (planet_id) REFERENCES planets(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36),
  type VARCHAR(50),
  payload JSON,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
